import type { RoomIdentity, RoomPlayback } from '~/utils/listen-client'
import type { ClientMessage, RoomSnapshot, ServerMessage } from '#shared/types/listen-room'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ListenClient, publicTrack } from '~/utils/listen-client'

class Socket {
  static OPEN = 1
  static all: Socket[] = []
  readyState = 1
  sent: ClientMessage[] = []
  onopen?: () => void
  onmessage?: (event: { data: string }) => Promise<void>
  onclose?: () => void
  constructor() { Socket.all.push(this) }
  send(value: string) { this.sent.push(JSON.parse(value)) }
  close() { this.readyState = 3; this.onclose?.() }
  receive(message: ServerMessage) { return this.onmessage?.({ data: JSON.stringify(message) }) }
}
const track = { provider: 'netease' as const, id: 'one', title: 'Song', duration: 120, coverUrl: '', queueItemId: 'item-one' }
const snapshot = (patch: Partial<RoomSnapshot> = {}): RoomSnapshot => ({
  protocol: 1, roomId: 'room', code: '12345678', revision: 0, playbackId: 'playback', kind: 'music', queue: [track], currentIndex: 0, playMode: 'order',
  track: { id: track.queueItemId, duration: 120 }, status: 'paused', wantsToPlay: false, pauseReason: 'user', positionAtAnchor: 0, anchorServerTime: 0, rate: 1,
  hostId: 'host', members: [], ...patch,
})
let client: ListenClient
let socket: Socket
let playback: RoomPlayback
let persist = vi.fn<(identity?: RoomIdentity) => void>()
let exited = vi.fn<() => void>()
let lockAvailable: boolean

async function connect(memberId = 'member') {
  client.open('http://localhost:3410', { type: 'join', protocol: 1, kind: 'music', name: 'test', code: '12345678' })
  socket = Socket.all.at(-1)!
  socket.onopen?.()
  await socket.receive({ type: 'welcome', token: 'secret', memberId, generation: 1, snapshot: snapshot() })
  await socket.receive({ type: 'pong', sentAt: performance.now(), serverTime: performance.now() })
  await vi.advanceTimersByTimeAsync(0)
}
beforeEach(() => {
  vi.useFakeTimers()
  Socket.all = []; lockAvailable = true
  vi.stubGlobal('WebSocket', Socket)
  vi.stubGlobal('navigator', { locks: { request: (_: string, __: unknown, callback: (lock: object | null) => unknown) => Promise.resolve(callback(lockAvailable ? {} : null)) } })
  let position = 0
  let paused = true
  const audio = document.createElement('audio')
  Object.defineProperties(audio, {
    readyState: { value: 4, configurable: true }, duration: { value: 120, configurable: true }, paused: { get: () => paused },
    currentTime: { get: () => position, set(value) { position = value; queueMicrotask(() => audio.dispatchEvent(new Event('seeked'))) } },
  })
  audio.pause = vi.fn(() => { paused = true })
  audio.play = vi.fn(async () => { paused = false })
  playback = { audio, queue: vi.fn(), cancelLoad: vi.fn(), empty: vi.fn(), load: vi.fn(async () => { audio.src = 'https://cdn.example/song.mp3'; return 'loaded' as const }) }
  persist = vi.fn(); exited = vi.fn()
  client = new ListenClient(playback, () => {}, persist, exited)
})
afterEach(() => { client.dispose(); vi.useRealTimers(); vi.unstubAllGlobals() })

describe('product room controller', () => {
  it('successfully prepares native media, starts on schedule and confirms actual sync', async () => {
    await connect()
    await socket.receive({ type: 'snapshot', snapshot: snapshot({ revision: 1, status: 'scheduled', wantsToPlay: true, anchorServerTime: 500 }) })
    await vi.advanceTimersByTimeAsync(600)
    expect(playback.audio.play).toHaveBeenCalled()
    expect(client.status).toBe('following')
    expect(client.inSync).toBe(false)
  })
  it('active member pause survives new remote state and never pauses the whole room', async () => {
    await connect()
    client.control({ type: 'play', playing: false })
    await socket.receive({ type: 'snapshot', snapshot: snapshot({ revision: 1, status: 'playing', wantsToPlay: true }) })
    await vi.advanceTimersByTimeAsync(1_000)
    expect(client.away).toBe(true)
    expect(playback.audio.play).not.toHaveBeenCalled()
    expect(socket.sent.some(m => m.type === 'command')).toBe(false)
    expect(persist).toHaveBeenLastCalledWith(expect.objectContaining({ away: true }))
  })
  it.each(['host', 'member'])('rejects a %s duration mismatch instead of syncing previews', async (memberId) => {
    Object.defineProperty(playback.audio, 'duration', { value: 30 })
    await connect(memberId)
    expect(client.status).toBe('failed')
    expect(client.error).toContain('时长')
    expect(playback.audio.play).not.toHaveBeenCalled()
  })
  it('blocked playback remains blocked across remote seek until user explicitly resumes', async () => {
    await connect()
    vi.mocked(playback.audio.play).mockRejectedValueOnce(new DOMException('blocked', 'NotAllowedError'))
    await socket.receive({ type: 'snapshot', snapshot: snapshot({ revision: 1, status: 'playing', wantsToPlay: true }) })
    await vi.advanceTimersByTimeAsync(100)
    expect(client.status).toBe('blocked')
    await socket.receive({ type: 'snapshot', snapshot: snapshot({ revision: 2, status: 'playing', wantsToPlay: true }) })
    await vi.advanceTimersByTimeAsync(100)
    expect(playback.audio.play).toHaveBeenCalledTimes(1)
    client.follow()
    await vi.advanceTimersByTimeAsync(100)
    expect(playback.audio.play).toHaveBeenCalledTimes(2)
  })
  it('serializes controls until both the ack and corresponding snapshot arrive', async () => {
    await connect('host')
    client.control({ type: 'next', direction: 1 }); client.control({ type: 'play', playing: false })
    const commands = () => socket.sent.filter(m => m.type === 'command')
    expect(commands()).toHaveLength(1)
    const first = commands()[0]!
    await socket.receive({ type: 'ack', commandId: first.commandId, revision: 1 })
    expect(commands()).toHaveLength(1)
    await socket.receive({ type: 'snapshot', snapshot: snapshot({ revision: 1 }) })
    expect(commands()).toHaveLength(2)
    expect(commands()[1]).toMatchObject({ action: 'pause', expectedRevision: 1 })
  })
  it('only the host advances after ended, and members cannot mutate the queue', async () => {
    await connect()
    client.control({ type: 'ended' }); client.control({ type: 'queue', tracks: [] })
    expect(socket.sent.some(m => m.type === 'command')).toBe(false)
    expect(client.error).toContain('房主')
  })
  it('rejects oversized queues locally without breaking the room connection', async () => {
    await connect('host')
    client.control({ type: 'queue', tracks: Array.from({ length: 1_001 }, () => track) })
    expect(client.error).toContain('1000')
    expect(client.connection).toBe('connected')
    expect(socket.sent.some(m => m.type === 'command')).toBe(false)
  })
  it('bounds silent outages even if the first response has monotonic timestamp zero', async () => {
    await connect()
    await socket.receive({ type: 'snapshot', snapshot: snapshot({ revision: 1, status: 'playing', wantsToPlay: true }) })
    await vi.advanceTimersByTimeAsync(1_000)
    expect(playback.audio.paused).toBe(false)
    await vi.advanceTimersByTimeAsync(20_000)
    expect(playback.audio.paused).toBe(true)
  })
  it('blocks duplicate playback windows before using a stored resume token', async () => {
    lockAvailable = false
    await client.resume({ server: 'http://localhost:3410', token: 'secret', roomId: 'room', away: false })
    expect(Socket.all).toHaveLength(0)
    expect(exited).toHaveBeenCalledOnce()
    expect(client.error).toContain('另一个窗口')
  })
  it('redacts signed URLs from member error reports and preserves a retryable failure', async () => {
    vi.mocked(playback.load).mockRejectedValueOnce(new Error('failed https://cdn.example/secret?token=private'))
    await connect()
    const reports = socket.sent.filter(m => m.type === 'report')
    expect(JSON.stringify(reports)).not.toContain('token=private')
    expect(client.status).toBe('failed')
  })
  it('does not trust malformed server snapshots', async () => {
    await connect()
    await socket.onmessage?.({ data: JSON.stringify({ type: 'snapshot', snapshot: { code: 'x', queue: [{ src: 'https://private.example' }] } }) })
    expect(exited).toHaveBeenCalledOnce()
    expect(client.error).toContain('协议')
  })
})

it('only shares public metadata even if local MusicInfo contains audio and lyrics', () => {
  const input = { ...track, src: 'https://private.example/signed', lrc: 'private', cookie: 'secret' }
  const result = publicTrack(input)
  expect(result).not.toHaveProperty('src')
  expect(result).not.toHaveProperty('lrc')
  expect(result).not.toHaveProperty('cookie')
})
