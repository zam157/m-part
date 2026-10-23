import type { ClientMessage, MemberStatus, RoomSnapshot, ServerMessage } from '@m-part/listen-core/protocol'
import { CONNECTION_TIMEOUT_MS, DISCONNECT_GRACE_MS, HEARTBEAT_MS, LISTEN_PROTOCOL } from '@m-part/listen-core/protocol'
import { ListenClock, roomPosition, shouldSeek } from '@m-part/listen-core/clock'

import { prepareMedia, startMedia } from '@m-part/listen-core/browser/media'
export { prepareMedia, startMedia } from '@m-part/listen-core/browser/media'

const STORAGE_KEY = 'm-part:listen-lab:v1'

export interface Telemetry {
  localTime: number
  serverTime: number
  position: number
  target: number
  errorMs: number
  uncertaintyMs: number | null
  status: MemberStatus
  connected: boolean
  revision: number
  playbackId: string
  seeks: number
  steady: boolean
}

/** Isolated lab controller. It never imports the product player or its persistence. */
export class ListenLabSession {
  readonly audio: HTMLAudioElement
  readonly clock = new ListenClock()
  snapshot?: RoomSnapshot
  memberId?: string
  status: MemberStatus = 'loading'
  connection = '未连接'
  error = ''
  away = false
  threshold = 0.3
  seeks = 0
  samples: Telemetry[] = []
  events: { at: number, event: string }[] = []
  simulateBlocked = false
  simulateBuffer = false
  private socket?: WebSocket
  private token?: string
  private operation?: AbortController
  private scheduled?: ReturnType<typeof setTimeout>
  private bufferTimer?: ReturnType<typeof setTimeout>
  private reconnectTimer?: ReturnType<typeof setTimeout>
  private interval: ReturnType<typeof setInterval>
  private lastPing = 0
  private lastResponse = 0
  private lastSample = 0
  private lastSeek = -Infinity
  private attempt = 0
  private stopped = false
  private pending?: string
  private savedRevision = -1
  private storedRoomId?: string
  private lastTransition = 0

  constructor(private changed: () => void, audio = new Audio('/calibration.wav')) {
    this.audio = audio
    audio.preload = 'auto'
    audio.volume = 0.25
    audio.addEventListener('waiting', this.onWaiting)
    audio.addEventListener('error', this.onError)
    window.addEventListener('pagehide', this.onPageHide)
    document.addEventListener('visibilitychange', this.onVisible)
    try {
      const saved = JSON.parse(sessionStorage.getItem(STORAGE_KEY) || 'null')
      if (saved?.token) { this.token = saved.token; this.away = saved.away === true; this.storedRoomId = saved.roomId }
    }
    catch { sessionStorage.removeItem(STORAGE_KEY) }
    this.interval = setInterval(() => this.tick(), 250)
    if (this.token) this.connect({ type: 'resume', token: this.token, protocol: LISTEN_PROTOCOL })
  }

  get isHost() { return !!this.snapshot && this.snapshot.hostId === this.memberId }
  get connected() { return this.connection === '已连接' }
  get busy() { return !!this.pending }

  private log(event: string) {
    this.events.push({ at: performance.now(), event })
    if (this.events.length > 2_000) this.events.shift()
  }

  private persist() {
    if (this.token) sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ token: this.token, away: this.away, roomId: this.snapshot?.roomId ?? this.storedRoomId }))
  }

  create(name: string) { this.reset(); this.connect({ type: 'create', protocol: LISTEN_PROTOCOL, name }) }
  join(code: string, name: string) { this.reset(); this.connect({ type: 'join', protocol: LISTEN_PROTOCOL, name, code: code.trim() }) }

  private reset() {
    this.leave()
    this.stopped = false
    this.away = false
    this.error = ''
    this.status = 'loading'
    this.samples = []; this.events = []; this.seeks = 0
    this.lastResponse = 0
    this.attempt = 0
  }

  private connect(hello: Extract<ClientMessage, { type: 'create' | 'join' | 'resume' }>) {
    if (this.stopped) return
    this.connection = '连接中'
    const socket = new WebSocket(`${location.protocol === 'https:' ? 'wss:' : 'ws:'}//${location.host}/ws`)
    this.socket = socket
    socket.onopen = () => socket.send(JSON.stringify(hello))
    socket.onmessage = (event) => {
      if (this.socket !== socket) return
      let message: ServerMessage
      try { message = JSON.parse(event.data) }
      catch { this.error = '无效服务器消息'; socket.close(); return }
      this.lastResponse = performance.now()
      if (message.type === 'welcome') {
        if (message.snapshot.kind !== 'lab') { this.error = '实验页只能加入静态音频实验房间'; this.leave(); return }
        if (this.storedRoomId && this.storedRoomId !== message.snapshot.roomId) { this.error = '房间实例发生变化'; this.leave(); return }
        this.token = message.token; this.memberId = message.memberId
        this.connection = '已连接'; this.attempt = 0; this.pending = undefined
        this.savedRevision = -1
        this.clock.reset()
        this.snapshot = message.snapshot
        this.storedRoomId = message.snapshot.roomId
        this.persist(); this.ping(); this.log('connected')
        for (let i = 1; i <= 4; i++) setTimeout(() => { if (this.socket === socket && this.connected) this.ping() }, i * 100)
      }
      else if (message.type === 'snapshot') this.receiveSnapshot(message.snapshot)
      else if (message.type === 'pong') {
        const wasUncalibrated = !this.clock.estimate
        this.clock.add(message.sentAt, performance.now(), message.serverTime)
        if (wasUncalibrated && this.snapshot) this.apply(this.snapshot)
      }
      else if (message.type === 'ack') { if (message.commandId === this.pending) this.pending = undefined }
      else if (message.type === 'error') {
        this.error = message.message
        this.log(`error:${message.code}`)
        if (message.commandId === this.pending) this.pending = undefined
        if (['expired', 'ended'].includes(message.code)) this.leave()
        else if (!this.token) { this.stopped = true; this.connection = '未连接'; socket.close() }
      }
      else if (message.type === 'replaced') {
        this.error = '此会话已由另一个窗口接管'
        this.stopped = true; this.cancel(); this.audio.pause(); this.connection = '已被接管'
        // Only clear this window's copy; never issue leave against the new connection.
        sessionStorage.removeItem(STORAGE_KEY)
        socket.close()
      }
      this.changed()
    }
    socket.onclose = () => {
      if (this.socket !== socket) return
      if (!this.stopped) {
        this.connection = this.token ? '已断开，等待重连' : '未连接'; this.cancel(); this.pending = undefined; this.log('disconnected')
        if (this.token) {
          const delay = Math.min(5_000, 400 * 2 ** this.attempt++) + Math.random() * 250
          this.reconnectTimer = setTimeout(() => this.connect({ type: 'resume', token: this.token!, protocol: LISTEN_PROTOCOL }), delay)
        }
      }
      this.changed()
    }
    socket.onerror = () => { this.error = '房间连接失败'; this.changed() }
    this.changed()
  }

  private send(message: ClientMessage) {
    if (this.socket?.readyState === WebSocket.OPEN) this.socket.send(JSON.stringify(message))
  }

  private ping() { this.lastPing = performance.now(); this.send({ type: 'ping', sentAt: this.lastPing }) }

  command(action: 'play' | 'pause' | 'seek' | 'restart', position?: number) {
    if (!this.isHost || !this.connected || this.pending || !this.snapshot) return
    this.error = ''
    if (action === 'play' && (this.status === 'blocked' || this.status === 'failed')) this.status = 'loading'
    this.pending = crypto.randomUUID()
    this.send({ type: 'command', action, position, commandId: this.pending, expectedRevision: this.snapshot.revision })
    this.log(`command:${action}`)
    this.changed()
  }

  private receiveSnapshot(state: RoomSnapshot) {
    if (state.roomId !== this.snapshot?.roomId || state.revision < this.savedRevision) return
    this.snapshot = state
    if (state.status === 'ended') {
      this.error = '房间已结束'; this.log('ended'); this.leave(); return
    }
    if (state.revision !== this.savedRevision && this.clock.estimate) this.apply(state)
  }

  private cancel() {
    this.operation?.abort()
    clearTimeout(this.scheduled); clearTimeout(this.bufferTimer)
    this.scheduled = undefined; this.bufferTimer = undefined
    this.audio.playbackRate = 1
  }

  private report(status: MemberStatus, state = this.snapshot) {
    if (!state) return
    if (this.status !== status) this.lastTransition = performance.now()
    this.status = status
    this.send({ type: 'report', status, revision: state.revision, playbackId: state.playbackId })
    this.changed()
  }

  private async apply(state: RoomSnapshot) {
    this.cancel()
    this.lastTransition = performance.now()
    this.savedRevision = state.revision
    if (this.away || this.status === 'blocked') { this.audio.pause(); this.report(this.away ? 'away' : 'blocked', state); return }
    const controller = new AbortController()
    this.operation = controller
    const active = () => !controller.signal.aborted && this.connected && this.snapshot?.revision === state.revision
    this.audio.pause()
    this.status = 'loading'
    this.log(`prepare:${state.revision}`)
    try {
      if (this.simulateBuffer) { this.status = 'buffering'; return }
      const result = await prepareMedia(this.audio, roomPosition(state, this.clock.now(performance.now())), controller.signal)
      if (result === 'stale' || !active()) return
      this.report('ready', state)
      if (state.status === 'paused' || state.status === 'preparing') return
      const delay = Math.max(0, state.anchorServerTime - this.clock.now(performance.now()))
      this.scheduled = setTimeout(() => { void this.start(state, controller) }, delay)
    }
    catch (error) {
      if (!active()) return
      this.error = error instanceof Error ? error.message : String(error)
      this.report('failed', state)
    }
    finally { this.changed() }
  }

  private async start(state: RoomSnapshot, controller: AbortController) {
    const active = () => !controller.signal.aborted && this.connected && !this.away && this.snapshot?.revision === state.revision
    if (!active()) return
    try {
      const result = await prepareMedia(this.audio, roomPosition(state, this.clock.now(performance.now())), controller.signal)
      if (result === 'stale' || !active()) return
      if (this.simulateBlocked) { this.simulateBlocked = false; throw new DOMException('模拟自动播放受阻，请点击恢复', 'NotAllowedError') }
      if (await startMedia(this.audio, controller.signal) === 'stale') return
      if (!active()) return
      this.report('following', state)
      this.log('playing')
    }
    catch (error) {
      if (!active()) return
      this.error = error instanceof Error ? error.message : String(error)
      this.report(error instanceof DOMException && error.name === 'NotAllowedError' ? 'blocked' : 'failed', state)
      this.log(`start-failed:${this.status}`)
    }
  }

  pauseLocal() {
    if (this.isHost) { this.command('pause'); return }
    this.away = true; this.cancel(); this.audio.pause(); this.persist(); this.report('away'); this.log('away')
  }

  resumeLocal() {
    this.away = false; this.status = 'loading'; this.error = ''; this.persist(); this.log('resume')
    if (this.isHost) this.command('play')
    else if (this.snapshot && this.clock.estimate) void this.apply(this.snapshot)
  }

  buffer(enabled: boolean) {
    this.simulateBuffer = enabled
    if (enabled) {
      this.cancel(); this.audio.pause(); this.report('buffering'); this.log('buffering')
    }
    else if (this.snapshot && !this.away) { this.log('buffer-recovered'); void this.apply(this.snapshot) }
  }

  disconnectForTest() { this.socket?.close() }

  private onWaiting = () => {
    if (this.status !== 'following' || this.away) return
    clearTimeout(this.bufferTimer)
    this.bufferTimer = setTimeout(() => {
      if (this.audio.readyState >= 3 || this.status !== 'following') return
      this.report('buffering'); this.log('buffering')
      if (!this.isHost && this.snapshot) void this.apply(this.snapshot)
    }, 500)
  }
  private onError = () => { this.error = this.audio.error?.message ?? '媒体错误'; this.report('failed') }
  private onPageHide = () => { this.persist(); this.audio.pause(); this.socket?.close() }
  private onVisible = () => {
    if (document.visibilityState !== 'visible') return
    this.clock.reset(); this.savedRevision = -1
    if (this.connected) this.ping()
  }

  private tick() {
    const now = performance.now()
    if (this.connected && now - this.lastPing >= HEARTBEAT_MS) this.ping()
    if (this.connected && now - this.lastResponse >= CONNECTION_TIMEOUT_MS) this.socket?.close()
    if (this.lastResponse && now - this.lastResponse >= DISCONNECT_GRACE_MS) { this.cancel(); this.audio.pause(); this.status = this.away ? 'away' : 'loading' }
    const state = this.snapshot
    if (state && this.clock.estimate) {
      const serverTime = this.clock.now(now)
      const target = roomPosition(state, serverTime)
      const error = this.audio.currentTime - target
      if (this.connected && !this.away && this.status === 'following' && !this.audio.paused && (state.status === 'playing' || (state.status === 'scheduled' && serverTime >= state.anchorServerTime))) {
        if (shouldSeek(error, now, this.lastSeek, { threshold: this.threshold, cooldownMs: 2_000 })) {
          this.lastSeek = now; this.seeks++; this.log('drift-seek')
          void this.apply(state)
        }
      }
      if (now - this.lastSample >= 500) {
        this.lastSample = now
        this.samples.push({ localTime: now, serverTime, position: this.audio.currentTime, target, errorMs: error * 1000, uncertaintyMs: this.clock.uncertaintyMs, status: this.status, connected: this.connected, revision: state.revision, playbackId: state.playbackId, seeks: this.seeks, steady: this.status === 'following' && now - this.lastTransition >= 2_000 })
        if (this.samples.length > 7_200) this.samples.shift()
      }
    }
    this.changed()
  }

  leave() {
    this.stopped = true
    clearTimeout(this.reconnectTimer)
    this.send({ type: 'leave' })
    this.socket?.close(); this.socket = undefined
    this.cancel(); this.audio.pause()
    this.token = undefined; this.memberId = undefined; this.snapshot = undefined; this.storedRoomId = undefined
    this.pending = undefined; this.savedRevision = -1
    this.connection = '未连接'; this.clock.reset()
    sessionStorage.removeItem(STORAGE_KEY)
    this.changed()
  }

  dispose() {
    // A refresh is a recoverable disconnect, not an explicit leave.
    this.persist(); this.stopped = true; this.cancel(); clearTimeout(this.reconnectTimer)
    clearInterval(this.interval); this.audio.pause(); this.socket?.close()
    this.audio.removeEventListener('waiting', this.onWaiting)
    this.audio.removeEventListener('error', this.onError)
    window.removeEventListener('pagehide', this.onPageHide)
    document.removeEventListener('visibilitychange', this.onVisible)
  }
}
