// @vitest-environment jsdom
import type { RoomSnapshot, ServerMessage } from '@m-part/listen-core/protocol'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ListenLabSession } from '../client/session'
import { LAB_TRACK, LISTEN_PROTOCOL } from '@m-part/listen-core/protocol'

class Socket {
  static OPEN = 1
  static all: Socket[] = []
  readyState = 1
  sent: Record<string, unknown>[] = []
  onopen?: () => void
  onmessage?: (event: { data: string }) => void
  onclose?: () => void
  constructor() { Socket.all.push(this) }
  send(data: string) { this.sent.push(JSON.parse(data)) }
  close() { this.readyState = 3; this.onclose?.() }
  receive(message: ServerMessage) { this.onmessage?.({ data: JSON.stringify(message) }) }
}
function media() {
  const element = document.createElement('audio')
  Object.defineProperties(element, {
    readyState: { value: 4, configurable: true }, duration: { value: 90 }, paused: { value: true, writable: true },
  })
  element.pause = vi.fn(() => Object.defineProperty(element, 'paused', { value: true, writable: true }))
  element.play = vi.fn(async () => { Object.defineProperty(element, 'paused', { value: false, writable: true }) })
  return element
}
const state = (patch: Partial<RoomSnapshot> = {}): RoomSnapshot => ({
  protocol: LISTEN_PROTOCOL, roomId: 'room', code: '12345678', revision: 0, playbackId: 'playback', track: LAB_TRACK,
  status: 'paused', wantsToPlay: false, pauseReason: 'user', positionAtAnchor: 0, anchorServerTime: 0, rate: 1,
  hostId: 'host', members: [], ...patch,
  kind: 'lab', queue: [], currentIndex: null, playMode: 'order',
})
let session: ListenLabSession
let socket: Socket
let audio: HTMLAudioElement
function connected(memberId = 'member') {
  socket.receive({ type: 'welcome', token: 'secret', memberId, generation: 1, snapshot: state() })
  socket.receive({ type: 'pong', sentAt: performance.now(), serverTime: performance.now() })
}
beforeEach(() => {
  vi.useFakeTimers()
  sessionStorage.clear(); Socket.all = []
  vi.stubGlobal('WebSocket', Socket)
  audio = media()
  session = new ListenLabSession(() => {}, audio)
  session.create('test')
  socket = Socket.all.at(-1)!
  socket.onopen?.()
})
afterEach(() => { session.dispose(); vi.useRealTimers(); vi.unstubAllGlobals(); vi.restoreAllMocks() })

describe('local intent, cancellation and reconnect', () => {
  it('never restarts an actively paused member on a room seek or reconnect', async () => {
    connected()
    session.pauseLocal()
    socket.receive({ type: 'snapshot', snapshot: state({ revision: 1, status: 'scheduled', anchorServerTime: 500, wantsToPlay: true }) })
    await vi.advanceTimersByTimeAsync(1_000)
    expect(audio.play).not.toHaveBeenCalled()
    expect(session.away).toBe(true)
    expect(JSON.parse(sessionStorage.getItem('m-part:listen-lab:v1')!).away).toBe(true)
    socket.close()
    await vi.advanceTimersByTimeAsync(1_000)
    socket = Socket.all.at(-1)!
    connected()
    expect(session.away).toBe(true)
    expect(audio.play).not.toHaveBeenCalled()
  })
  it('cancels old scheduled play when a newer pause arrives', async () => {
    connected()
    socket.receive({ type: 'snapshot', snapshot: state({ revision: 1, status: 'scheduled', anchorServerTime: 500 }) })
    await vi.advanceTimersByTimeAsync(100)
    socket.receive({ type: 'snapshot', snapshot: state({ revision: 2 }) })
    await vi.advanceTimersByTimeAsync(1_000)
    expect(audio.play).not.toHaveBeenCalled()
  })
  it('does not present a rejected play promise as following', async () => {
    connected()
    vi.mocked(audio.play).mockRejectedValueOnce(new DOMException('blocked', 'NotAllowedError'))
    socket.receive({ type: 'snapshot', snapshot: state({ revision: 1, status: 'scheduled', anchorServerTime: 100 }) })
    await vi.advanceTimersByTimeAsync(250)
    expect(session.status).toBe('blocked')
    expect(socket.sent.some(m => m.type === 'report' && m.status === 'blocked')).toBe(true)
    socket.receive({ type: 'snapshot', snapshot: state({ revision: 2, status: 'playing' }) })
    await vi.advanceTimersByTimeAsync(250)
    expect(audio.play).toHaveBeenCalledTimes(1)
  })
  it('stops the old window without issuing leave or reconnect when replaced', async () => {
    connected('host')
    socket.receive({ type: 'replaced' })
    await vi.advanceTimersByTimeAsync(5_000)
    expect(audio.paused).toBe(true)
    expect(Socket.all).toHaveLength(1)
    expect(socket.sent.some(m => m.type === 'leave')).toBe(false)
    expect(sessionStorage.getItem('m-part:listen-lab:v1')).toBeNull()
  })
  it('serializes commands and does not replay unconfirmed controls after disconnect', async () => {
    connected('host')
    session.command('play'); session.command('pause')
    expect(socket.sent.filter(m => m.type === 'command')).toHaveLength(1)
    socket.close()
    await vi.advanceTimersByTimeAsync(1_000)
    socket = Socket.all.at(-1)!
    socket.onopen?.()
    connected('host')
    expect(socket.sent.filter(m => m.type === 'command')).toHaveLength(0)
  })
  it('pauses locally after a silent outage', async () => {
    connected()
    await vi.advanceTimersByTimeAsync(21_000)
    expect(audio.paused).toBe(true)
  })
  it('restores baseline speed immediately on temporary leave and never restarts correction while away', async () => {
    const now = vi.spyOn(performance, 'now').mockReturnValue(0)
    connected()
    await vi.advanceTimersByTimeAsync(0)
    session.setStrategy('rate')
    session.snapshot = state({ status: 'playing', anchorServerTime: performance.now() })
    session.status = 'following'
    await audio.play()
    audio.currentTime = 0.55
    now.mockReturnValue(250)
    await vi.advanceTimersByTimeAsync(250)
    expect(audio.playbackRate).toBe(0.98)
    session.pauseLocal()
    expect(audio.playbackRate).toBe(1)
    await vi.advanceTimersByTimeAsync(500)
    expect(audio.playbackRate).toBe(1)
    expect(audio.paused).toBe(true)
  })
})
