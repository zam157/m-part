import type { HostedPlatform, RoomControl, RoomTicket, ClientMessage, MemberStatus, RoomSnapshot, SharedRoomTrack } from '@m-part/listen-core/protocol'
import type { RoomPlayerAction } from '~/composables/player-context'
import * as v from 'valibot'
import { CONNECTION_TIMEOUT_MS, DISCONNECT_GRACE_MS, HEARTBEAT_MS, LISTEN_PROTOCOL, clientMessage, roomSnapshot, roomTicket, serverMessage } from '@m-part/listen-core/protocol'
import { ListenClock, roomPosition, shouldSeek } from '@m-part/listen-core/clock'
import { prepareMedia, startMedia } from '@m-part/listen-core/browser/media'
import { uniqueTracks } from '@m-part/listen-core/queue'
import { needsTrackParts } from './track-parts'
import { sendRoomControl } from './room-http'

export interface RoomIdentity { server: string, token: string, roomId: string, away: boolean, personalSource?: boolean }
export interface RoomPlayback {
  audio: HTMLAudioElement
  queue: (state: RoomSnapshot) => void
  load: (track: SharedRoomTrack, index: number, signal: AbortSignal, quality?: string, hostedUrl?: string) => Promise<'loaded' | 'stale'>
  cancelLoad: () => void
  empty: () => void
}
type Command = Omit<Extract<ClientMessage, { type: 'command' }>, 'type' | 'commandId' | 'expectedRevision'>

/** Product room controller: media events report readiness, never rebroadcast user controls. */
export class ListenClient {
  snapshot?: RoomSnapshot
  memberId?: string
  connection: 'idle' | 'connecting' | 'connected' | 'reconnecting' = 'idle'
  status: MemberStatus = 'loading'
  error = ''
  away = false
  inSync = false
  personalSource = false
  sourceBusy = false
  readonly clock = new ListenClock()
  private socket?: WebSocket
  private identity?: RoomIdentity
  private controller?: AbortController
  private scheduled?: ReturnType<typeof setTimeout>
  private bufferTimer?: ReturnType<typeof setTimeout>
  private retryTimer?: ReturnType<typeof setTimeout>
  private interval?: ReturnType<typeof setInterval>
  private releaseWindow?: () => void
  private stopped = false
  private lastResponse = -Infinity
  private lastPing = 0
  private lastSeek = -Infinity
  private attempts = 0
  private activeRevision = -1
  private loadedKey?: string
  private failedKey?: string
  private quality?: string
  private mediaTicket?: RoomTicket & { renewAt: number, key: string }
  private renewing = false
  private management?: AbortController
  private interaction?: { id: string, sentAt: number, finish: (ok: boolean) => void }
  private confirmations = 0
  private commands: Command[] = []
  private pending?: { id: string, revision?: number, sentAt: number }

  constructor(
    private playback: RoomPlayback,
    private changed: () => void,
    private persist: (identity?: RoomIdentity) => void,
    private exited: () => void,
  ) {
    playback.audio.addEventListener('waiting', this.onWaiting)
    playback.audio.addEventListener('error', this.onError)
    window.addEventListener('pagehide', this.onPageHide)
    document.addEventListener('visibilitychange', this.onVisible)
    this.interval = setInterval(() => this.tick(), 250)
  }

  get isHost() { return !!this.snapshot && this.memberId === this.snapshot.hostId }
  get canControl() { return this.isHost || !!this.snapshot?.members.some(member => member.id === this.memberId && member.role === 'admin') }
  get interactionBusy() { return !!this.interaction }
  get busy() { return !!this.pending || !!this.commands.length }

  async resume(identity: RoomIdentity) {
    this.identity = identity
    this.away = identity.away
    this.personalSource = !!identity.personalSource
    if (!await this.lock(identity.roomId, identity.server)) { this.fail('这个房间已在另一个窗口播放，请先退出或关闭原窗口'); return }
    this.connect(identity.server, { type: 'resume', protocol: LISTEN_PROTOCOL, token: identity.token })
  }
  open(server: string, hello: Extract<ClientMessage, { type: 'create' | 'join' }>) { this.connect(server, hello) }

  private async lock(roomId: string, server: string) {
    if (this.releaseWindow) return true
    if (!navigator.locks) throw new Error('当前浏览器不支持房间窗口协调，请使用新版 Chrome')
    return new Promise<boolean>((resolve, reject) => {
      navigator.locks.request(`m-part:listen:${server}:${roomId}`, { ifAvailable: true }, (lock) => {
        if (!lock) { resolve(false); return }
        return new Promise<void>((release) => { this.releaseWindow = release; resolve(true) })
      }).catch(reject)
    })
  }

  private connect(server: string, hello: Extract<ClientMessage, { type: 'create' | 'join' | 'resume' }>) {
    if (this.stopped) return
    this.connection = this.identity ? 'reconnecting' : 'connecting'
    const socket = new WebSocket(`${server.replace(/^http/, 'ws')}/ws`)
    this.socket = socket
    const opened = performance.now()
    socket.onopen = () => socket.send(JSON.stringify(hello))
    socket.onmessage = async (event) => {
      if (this.socket !== socket || this.stopped) return
      try {
        if (typeof event.data !== 'string' || event.data.length > 1_000_000) throw new Error('房间消息过大或格式错误')
        const parsed = v.safeParse(serverMessage, JSON.parse(event.data))
        if (!parsed.success) throw new Error('房间协议不兼容，请更新客户端与服务器')
        const message = parsed.output
        this.lastResponse = performance.now()
        if (message.type === 'welcome') {
          if (message.snapshot.kind !== 'music' || (this.identity && this.identity.roomId !== message.snapshot.roomId)) { this.fail('房间实例已失效，请重新加入'); return }
          this.memberId = message.memberId
          this.snapshot = message.snapshot
          if (!await this.lock(message.snapshot.roomId, server)) { this.send({ type: 'leave' }); this.fail('这个房间已在另一个窗口播放'); return }
          if (this.stopped || this.socket !== socket) return
          this.identity = { server, token: message.token, roomId: message.snapshot.roomId, away: this.away, personalSource: this.personalSource }
          this.persist(this.identity)
          this.connection = 'connected'; this.attempts = 0; this.activeRevision = -1
          this.clock.reset(); this.ping()
          for (let i = 1; i <= 4; i++) setTimeout(() => { if (this.socket === socket && this.connection === 'connected') this.ping() }, i * 100)
        }
        else if (message.type === 'pong') {
          const fresh = !this.clock.estimate
          this.clock.add(message.sentAt, performance.now(), message.serverTime)
          if (fresh && this.snapshot) void this.apply(this.snapshot)
        }
        else if (message.type === 'snapshot') {
          const state = message.snapshot
          if (state.roomId !== this.snapshot?.roomId || state.revision < this.activeRevision) return
          if (!this.acceptSnapshot(state)) return
          if (state.status === 'ended') { this.fail('房间已结束，已恢复个人播放队列'); return }
          if (this.connection === 'connected' && this.clock.estimate && state.revision !== this.activeRevision) void this.apply(state)
          this.advanceCommands()
        }
        else if (message.type === 'ack' && message.commandId === this.interaction?.id) { this.finishInteraction(true) }
        else if (message.type === 'ack' && message.commandId === this.pending?.id) { this.pending.revision = message.revision; this.advanceCommands() }
        else if (message.type === 'error') {
          this.error = message.message
          if (message.commandId === this.interaction?.id) this.finishInteraction(false)
          if (message.commandId === this.pending?.id) { this.pending = undefined; this.commands = [] }
          if (['expired', 'ended', 'not-found', 'unauthorized'].includes(message.code) || !this.identity || this.connection !== 'connected') { this.fail(message.message); return }
        }
        else if (message.type === 'replaced') { this.fail('房间已由另一个窗口接管'); return }
        this.changed()
      }
      catch (error) { this.fail(error instanceof Error ? error.message : '房间消息无法处理') }
    }
    socket.onclose = () => {
      if (this.socket !== socket || this.stopped) return
      if (this.interaction) { this.error = '连接已中断，操作结果待确认，请查看记录后重试'; this.finishInteraction(false) }
      this.cancel(); this.pending = undefined; this.commands = []; this.inSync = false
      if (!this.identity) { this.fail('无法连接房间服务器，请检查地址及服务是否启动'); return }
      this.connection = 'reconnecting'
      const delay = Math.min(5_000, 400 * 2 ** this.attempts++) + Math.random() * 200
      this.retryTimer = setTimeout(() => this.connect(server, { type: 'resume', protocol: LISTEN_PROTOCOL, token: this.identity!.token }), delay)
      this.changed()
    }
    socket.onerror = () => { this.error = '房间连接中断，正在尝试恢复'; this.changed() }
    setTimeout(() => { if (this.socket === socket && this.connection !== 'connected' && performance.now() - opened >= 5_000) socket.close() }, 5_000)
    this.changed()
  }

  private send(message: ClientMessage) {
    if (this.socket?.readyState === WebSocket.OPEN) this.socket.send(JSON.stringify(message))
  }
  private ping() { this.lastPing = performance.now(); this.send({ type: 'ping', sentAt: this.lastPing }) }

  private enqueue(command: Command) {
    if (!this.canControl) { this.error = '播放和队列由房主或管理员控制，你可以调音量或暂离'; this.changed(); return }
    if (this.connection !== 'connected') { this.error = '连接恢复后才能控制房间'; this.changed(); return }
    this.error = ''
    if (command.action === 'seek') this.commands = this.commands.filter(c => c.action !== 'seek')
    this.commands.push(command)
    if (this.commands.length > 20) this.commands.splice(0, this.commands.length - 20)
    this.advanceCommands()
    this.changed()
  }
  private advanceCommands() {
    if (this.pending?.revision !== undefined && this.snapshot && this.snapshot.revision >= this.pending.revision) this.pending = undefined
    if (!this.canControl) { this.commands = []; return }
    if (this.pending || !this.snapshot || this.connection !== 'connected') return
    const command = this.commands.shift()
    if (!command) return
    if (command.action === 'play' && this.snapshot.wantsToPlay) { this.advanceCommands(); return }
    this.pending = { id: crypto.randomUUID(), sentAt: performance.now() }
    this.send({ type: 'command', commandId: this.pending.id, expectedRevision: this.snapshot.revision, ...command })
  }

  control(action: RoomPlayerAction) {
    if (action.type === 'queue' || action.type === 'append-many') action = { ...action, tracks: uniqueTracks(action.tracks) }
    if ((action.type === 'queue' || action.type === 'append-many') && this.canControl && action.tracks.length > 1_000) {
      this.error = '房间队列最多支持 1000 首，请缩减后重试'; this.changed(); return
    }
    if (action.type === 'play') {
      if (action.playing) this.follow()
      else if (this.canControl) this.enqueue({ action: 'pause' })
      else this.pauseLocal()
      return
    }
    if (action.type === 'retry' && this.isHost && this.snapshot?.source?.mode === 'hosted' && this.snapshot.source.error && !this.personalSource) {
      void this.manageSource('retry-source').then(ok => { if (ok) this.follow() }); return
    }
    if (action.type === 'retry' || action.type === 'quality') {
      if (action.type === 'quality') this.quality = action.quality.name
      this.loadedKey = undefined; this.failedKey = undefined; this.error = ''; this.status = 'loading'
      if (this.isHost && this.snapshot?.wantsToPlay) this.report('buffering')
      this.follow()
      return
    }
    if (action.type === 'ended') { if (this.isHost) this.enqueue({ action: 'ended' }); return }
    if (action.type === 'queue') this.enqueue({ action: 'queue', tracks: action.tracks.map(track => publicTrack(track)) })
    else if (action.type === 'append-many') this.enqueue({ action: 'append-many', tracks: action.tracks.map(track => publicTrack(track)), placement: action.placement, autoplay: action.autoplay })
    else if (action.type === 'append' || action.type === 'add-next') this.enqueue({ action: action.type, track: publicTrack(action.track) })
    else if (action.type === 'select' || action.type === 'remove') this.enqueue({ action: action.type, queueItemId: this.snapshot?.queue[action.index]?.queueItemId })
    else if (action.type === 'mode') this.enqueue({ action: 'mode', mode: action.mode })
    else if (action.type === 'next') this.enqueue({ action: action.direction ? 'next' : 'previous' })
    else if (action.type === 'seek') this.enqueue({ action: 'seek', position: Math.max(0, Math.min(this.snapshot?.track.duration ?? 0, action.position)) })
  }

  async manageSource(action: 'credential' | 'revoke' | 'source' | 'retry-source', value?: string, provider?: HostedPlatform) {
    if (!this.identity || !this.snapshot || this.connection !== 'connected' || !this.isHost) { this.error = '连接恢复后由房主管理房间音源'; this.changed(); return false }
    if (action === 'source' && !provider) { this.error = '请选择要设置的音源'; this.changed(); return false }
    if (this.sourceBusy || this.busy) { this.error = '请等待当前房间操作完成'; this.changed(); return false }
    const controller = new AbortController()
    this.management = controller; this.sourceBusy = true; this.error = ''; this.changed()
    const base = { roomId: this.identity.roomId, expectedRevision: this.snapshot.revision }
    const request: RoomControl = action === 'credential' ? { ...base, action, provider: provider ?? 'netease', cookie: value ?? '' }
      : action === 'source' ? { ...base, action, provider: provider!, mode: value === 'hosted' ? 'hosted' : 'independent' }
        : action === 'revoke' ? { ...base, action, provider: provider ?? this.snapshot.source?.provider ?? 'netease' } : { ...base, action }
    try {
      const response = await sendRoomControl(this.identity.server, this.identity.token, request, controller.signal)
      if (!response || typeof response !== 'object' || !('ok' in response) || response.ok !== true) throw new Error('房间服务器响应不兼容')
      if ('snapshot' in response) {
        const state = v.parse(roomSnapshot, response.snapshot)
        if (state.roomId !== this.identity?.roomId) throw new Error('房间实例已更新')
        if (this.acceptSnapshot(state)) {
          if (this.clock.estimate && state.revision !== this.activeRevision) void this.apply(state)
        }
      }
      return true
    }
    catch (error) { if (!controller.signal.aborted) this.error = error instanceof Error ? error.message : '房间音源操作失败'; return false }
    finally { if (this.management === controller) { this.management = undefined; this.sourceBusy = false; this.changed() } }
  }

  private acceptSnapshot(state: RoomSnapshot) {
    if (this.snapshot && (state.revision < this.snapshot.revision || state.activityVersion < this.snapshot.activityVersion)) return false
    if (state.activityVersion === this.snapshot?.activityVersion) state.history = this.snapshot.history
    else if (this.snapshot) {
      const previous = new Map(this.snapshot.history.map(entry => [entry.id, entry]))
      state.history = state.history.map(entry => previous.get(entry.id) ?? entry)
    }
    // Preserve focused controls and scroll positions across heartbeat snapshots.
    if (this.snapshot) {
      const previous = new Map(this.snapshot.members.map(member => [member.id, member]))
      state.members = state.members.map(member => {
        const old = previous.get(member.id)
        return old && old.name === member.name && old.role === member.role && old.generation === member.generation && old.online === member.online && old.status === member.status && old.message === member.message ? old : member
      })
    }
    this.snapshot = state
    if (!this.canControl) { this.commands = []; this.pending = undefined }
    return true
  }

  private finishInteraction(ok: boolean) {
    const pending = this.interaction
    this.interaction = undefined
    pending?.finish(ok)
  }

  private interact(message: Extract<ClientMessage, { type: 'chat' | 'role' }>) {
    if (this.connection !== 'connected' || this.interaction) { this.error = this.interaction ? '请等待当前发送或授权完成' : '连接恢复后才能发送消息或授权'; this.changed(); return Promise.resolve(false) }
    const parsed = v.safeParse(clientMessage, message)
    if (!parsed.success) { this.error = '消息不能为空且最多 500 字'; this.changed(); return Promise.resolve(false) }
    this.error = ''
    return new Promise<boolean>((finish) => {
      this.interaction = { id: message.commandId, sentAt: performance.now(), finish }
      this.send(parsed.output); this.changed()
    })
  }

  sendChat(text: string) { return this.interact({ type: 'chat', commandId: crypto.randomUUID(), text }) }
  setMemberRole(memberId: string, role: 'admin' | 'member') {
    if (!this.isHost) { this.error = '仅房主可授权或撤销管理员'; this.changed(); return Promise.resolve(false) }
    return this.interact({ type: 'role', commandId: crypto.randomUUID(), memberId, role })
  }

  usePersonalSource(personal: boolean) {
    this.personalSource = personal; this.mediaTicket = undefined; this.loadedKey = undefined; this.failedKey = undefined
    this.cancel(); this.playback.cancelLoad(); this.error = ''; this.status = 'loading'; this.saveIdentity()
    if (this.snapshot && this.clock.estimate && this.connection === 'connected') void this.apply(this.snapshot)
    this.changed()
  }

  private async sourceUrl(state: RoomSnapshot, track: SharedRoomTrack, signal: AbortSignal, key: string) {
    if (state.source?.mode !== 'hosted' || this.personalSource) { this.mediaTicket = undefined; return undefined }
    if (!this.identity) throw new Error('房间连接尚未就绪')
    if (state.source.error) throw new Error(state.source.error)
    const reply = await sendRoomControl(this.identity.server, this.identity.token, {
      action: 'ticket', roomId: state.roomId, queueItemId: track.queueItemId, sourceVersion: state.source.version, playbackId: state.playbackId,
    }, signal)
    signal.throwIfAborted()
    const ticket = v.parse(roomTicket, reply)
    this.mediaTicket = { ...ticket, key, renewAt: performance.now() + ticket.leaseMs / 2 }
    const url = new URL('/room-audio', this.identity.server)
    url.searchParams.set('ticket', ticket.ticket)
    return url.href
  }

  private renewMediaTicket() {
    const ticket = this.mediaTicket
    if (!ticket || this.renewing || !this.identity || performance.now() < ticket.renewAt || this.status === 'failed') return
    this.renewing = true
    const signal = this.controller?.signal
    void sendRoomControl(this.identity.server, this.identity.token, { action: 'renew', roomId: this.identity.roomId, ticket: ticket.ticket }, signal)
      .then(reply => { if (this.mediaTicket === ticket) { const renewed = v.parse(roomTicket, reply); ticket.renewAt = performance.now() + renewed.leaseMs / 2 } })
      .catch(() => { if (this.mediaTicket === ticket && this.snapshot && !this.stopped && !signal?.aborted) this.playFailed(new Error('房间音源续期失败，请点击恢复同步'), ticket.key, this.snapshot) })
      .finally(() => { this.renewing = false })
  }

  pauseLocal() {
    this.away = true; this.cancel(); this.playback.audio.pause(); this.report('away'); this.saveIdentity()
  }
  follow() {
    if (this.mediaTicket && performance.now() >= this.mediaTicket.renewAt + this.mediaTicket.leaseMs / 2) { this.loadedKey = undefined; this.mediaTicket = undefined }
    this.away = false; this.failedKey = undefined; this.status = 'loading'; this.error = ''; this.saveIdentity()
    if (this.canControl && !this.snapshot?.wantsToPlay) this.enqueue({ action: 'play' })
    else if (this.snapshot && this.clock.estimate) void this.apply(this.snapshot)
  }
  private saveIdentity() { if (this.identity) { this.identity.away = this.away; this.identity.personalSource = this.personalSource; this.persist(this.identity) } }

  private cancel() {
    this.controller?.abort()
    clearTimeout(this.scheduled); clearTimeout(this.bufferTimer)
    this.playback.audio.playbackRate = 1
    this.inSync = false; this.confirmations = 0
  }
  private report(status: MemberStatus, message?: string, state = this.snapshot) {
    this.status = status
    if (state) this.send({ type: 'report', status, revision: state.revision, playbackId: state.playbackId,
      ...(status === 'ready' && this.isHost && Number.isFinite(this.playback.audio.duration) ? { duration: this.playback.audio.duration } : {}),
      ...(message ? { message: message.replace(/https?:\/\/\S+/g, '[音源地址]').slice(0, 300) } : {}),
    })
    this.changed()
  }

  private async apply(state: RoomSnapshot) {
    const audio = this.playback.audio
    const wasFollowing = this.status === 'following' && !audio.paused
    this.cancel(); this.activeRevision = state.revision
    this.playback.queue(state)
    const track = state.currentIndex === null ? undefined : state.queue[state.currentIndex]
    if (!track) { this.loadedKey = undefined; this.failedKey = undefined; this.playback.empty(); this.report('ready'); return }
    const source = state.source
    const key = `${track.provider}:${track.id}:${this.quality ?? ''}:${this.personalSource ? 'personal' : source?.mode ?? 'independent'}:${this.personalSource ? 0 : source?.version ?? 0}:${source?.mode === 'hosted' && !this.personalSource ? state.playbackId : ''}`
    if (this.away || this.status === 'blocked' || this.failedKey === key) {
      audio.pause(); this.report(this.away ? 'away' : this.status === 'blocked' ? 'blocked' : 'failed', this.error, state); return
    }
    this.error = ''
    const controller = new AbortController()
    this.controller = controller
    const active = () => !controller.signal.aborted && !this.stopped && this.connection === 'connected' && this.snapshot?.revision === state.revision
    const advancing = state.status === 'scheduled' || state.status === 'playing'
    if (this.loadedKey === key && wasFollowing && advancing && Math.abs(audio.currentTime - roomPosition(state, this.clock.now(performance.now()))) < 0.3) {
      this.report('following', undefined, state); return
    }
    audio.pause(); this.status = 'loading'; this.changed()
    let timeout: ReturnType<typeof setTimeout> | undefined
    try {
      if (this.loadedKey !== key || !audio.getAttribute('src') || audio.error) {
        const result = await Promise.race([
          (async () => {
            const url = await this.sourceUrl(state, track, controller.signal, key)
            return this.playback.load(track, state.currentIndex!, controller.signal, this.quality, url)
          })(),
          new Promise<never>((_, reject) => { timeout = setTimeout(() => reject(new Error('音源加载超时，请重试')), 20_000) }),
        ])
        clearTimeout(timeout)
        if (!active() || result === 'stale') return
        this.loadedKey = key
      }
      let result = await prepareMedia(audio, roomPosition(state, this.clock.now(performance.now())), controller.signal, 15_000)
      if (!active() || result === 'stale') return
      if (track.duration > 0 && Math.abs(audio.duration - track.duration) > Math.max(2, track.duration * 0.01)) throw new Error('本机音源时长与房间不同，可能是试听或不同版本，无法同步')
      this.report('ready', undefined, state)
      if (!advancing) return
      const delay = Math.max(0, state.anchorServerTime - this.clock.now(performance.now()))
      this.scheduled = setTimeout(async () => {
        if (!active() || this.away) return
        try {
          result = await prepareMedia(audio, roomPosition(state, this.clock.now(performance.now())), controller.signal, 15_000)
          if (!active() || result === 'stale') return
          if (await startMedia(audio, controller.signal) === 'stale' || !active()) return
          this.report('following', undefined, state)
        }
        catch (error) { if (active()) this.playFailed(error, key, state) }
      }, delay)
    }
    catch (error) { if (active()) { controller.abort(); this.playback.cancelLoad(); this.playFailed(error, key, state) } }
    finally { clearTimeout(timeout); this.changed() }
  }

  private playFailed(error: unknown, key: string, state: RoomSnapshot) {
    this.error = error instanceof Error || error instanceof DOMException ? error.message : String(error)
    const blocked = error instanceof DOMException && error.name === 'NotAllowedError'
    if (!blocked) this.failedKey = key
    this.playback.audio.pause(); this.inSync = false
    this.report(blocked ? 'blocked' : 'failed', this.error, state)
  }
  private onWaiting = () => {
    if (this.status !== 'following' || this.away) return
    clearTimeout(this.bufferTimer)
    this.bufferTimer = setTimeout(() => {
      if (this.playback.audio.readyState >= 3 || this.status !== 'following') return
      this.report('buffering')
      if (!this.isHost && this.snapshot) void this.apply(this.snapshot)
    }, 500)
  }
  private onError = () => {
    if (this.status === 'following' && this.snapshot) this.playFailed(new Error('音频加载失败，请重试'), this.loadedKey ?? '', this.snapshot)
  }
  private onPageHide = () => { this.saveIdentity(); this.dispose(false) }
  private onVisible = () => {
    if (document.visibilityState !== 'visible' || this.stopped) return
    this.clock.reset(); this.activeRevision = -1; this.inSync = false
    if (this.connection === 'connected') this.ping()
  }
  private tick() {
    if (this.stopped) return
    const now = performance.now()
    if (this.connection === 'connected' && now - this.lastPing >= HEARTBEAT_MS) this.ping()
    if (this.connection === 'connected' && now - this.lastResponse >= CONNECTION_TIMEOUT_MS) this.socket?.close()
    if (Number.isFinite(this.lastResponse) && now - this.lastResponse >= DISCONNECT_GRACE_MS) { this.cancel(); this.playback.audio.pause(); this.status = this.away ? 'away' : 'loading' }
    if (this.pending && now - this.pending.sentAt > 8_000) { this.error = '房间操作确认超时，请稍后重新操作'; this.pending = undefined; this.commands = []; this.ping() }
    if (this.interaction && now - this.interaction.sentAt > 8_000) { this.error = '发送或授权确认超时，请查看记录后再试'; this.finishInteraction(false) }
    const state = this.snapshot
    if (this.connection === 'connected' && state?.source?.mode === 'hosted' && !this.personalSource && !this.away) this.renewMediaTicket()
    if (this.connection === 'connected' && state && this.clock.estimate && this.status === 'following' && !this.away && !this.playback.audio.paused) {
      const error = this.playback.audio.currentTime - roomPosition(state, this.clock.now(now))
      this.confirmations = Math.abs(error) <= 0.3 ? this.confirmations + 1 : 0
      this.inSync = this.confirmations >= 3
      if (shouldSeek(error, now, this.lastSeek, { threshold: 0.3, cooldownMs: 2_000 })) { this.lastSeek = now; void this.apply(state) }
    }
    this.changed()
  }
  private fail(message: string) {
    this.error = message
    this.dispose(false)
    this.persist(undefined)
    this.exited()
    this.changed()
  }
  leave() { this.send({ type: 'leave' }); this.dispose(false); this.persist(undefined); this.exited(); this.changed() }
  dispose(notify = false) {
    if (notify) this.send({ type: 'leave' })
    this.finishInteraction(false)
    this.management?.abort(); this.mediaTicket = undefined
    this.stopped = true; this.cancel(); this.playback.cancelLoad(); this.playback.audio.pause()
    clearInterval(this.interval); clearTimeout(this.retryTimer)
    this.socket?.close(); this.socket = undefined; this.releaseWindow?.(); this.releaseWindow = undefined
    this.connection = 'idle'
    this.playback.audio.removeEventListener('waiting', this.onWaiting)
    this.playback.audio.removeEventListener('error', this.onError)
    window.removeEventListener('pagehide', this.onPageHide)
    document.removeEventListener('visibilitychange', this.onVisible)
  }
}

export function publicTrack(track: { provider: SharedRoomTrack['provider'], id: string, title: string, duration: number, coverUrl: string, artist?: string, album?: string }, options?: { preserveDuration?: boolean }) {
  return {
    provider: track.provider, id: String(track.id), title: track.title.slice(0, 300), duration: (options?.preserveDuration || !needsTrackParts(track)) && Number.isFinite(track.duration) ? Math.max(0, Math.min(86_400, track.duration)) : 0,
    coverUrl: /^https:\/\//i.test(track.coverUrl) ? track.coverUrl : '', artist: track.artist?.slice(0, 300), album: track.album?.slice(0, 300),
  }
}
