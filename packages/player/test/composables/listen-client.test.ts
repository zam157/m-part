import { LISTEN_PROTOCOL } from '@m-part/listen-core/protocol'
import type { RoomIdentity, RoomPlayback } from '~/utils/listen-client'
import type { ClientMessage, RoomSnapshot, ServerMessage } from '@m-part/listen-core/protocol'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ListenClient, publicTrack } from '~/utils/listen-client'

const { roomRequest } = vi.hoisted(() => ({ roomRequest: vi.fn() }))
vi.mock('~/utils/room-http', () => ({ sendRoomControl: roomRequest }))

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
  protocol: LISTEN_PROTOCOL, roomId: 'room', code: '12345678', revision: 0, playbackId: 'playback', kind: 'music', queue: [track], currentIndex: 0, playMode: 'order',
  track: { id: track.queueItemId, duration: 120 }, status: 'paused', wantsToPlay: false, pauseReason: 'user', positionAtAnchor: 0, anchorServerTime: 0, rate: 1,
  hostId: 'host', members: [], activityVersion: 0, history: [], ...patch,
})
let client: ListenClient
let socket: Socket
let playback: RoomPlayback
let persist = vi.fn<(identity?: RoomIdentity) => void>()
let exited = vi.fn<() => void>()
let lockAvailable: boolean

async function connect(memberId = 'member', patch: Partial<RoomSnapshot> = {}) {
  client.open('http://localhost:3410', { type: 'join', protocol: LISTEN_PROTOCOL, kind: 'music', name: 'test', code: '12345678' })
  socket = Socket.all.at(-1)!
  socket.onopen?.()
  await socket.receive({ type: 'welcome', token: 'secret', memberId, generation: 1, snapshot: snapshot(patch) })
  await socket.receive({ type: 'pong', sentAt: performance.now(), serverTime: performance.now() })
  await vi.advanceTimersByTimeAsync(0)
}
beforeEach(() => {
  vi.useFakeTimers()
  roomRequest.mockReset().mockResolvedValue({ ticket: 'a'.repeat(64), leaseMs: 120_000 })
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
    client.control({ type: 'queue', tracks: Array.from({ length: 1_001 }, (_, index) => ({ ...track, id: String(index) })) })
    expect(client.error).toContain('1000')
    expect(client.connection).toBe('connected')
    expect(socket.sent.some(m => m.type === 'command')).toBe(false)
  })
  it('deduplicates queue requests before checking capacity or sending them to the server', async () => {
    await connect('host')
    client.control({ type: 'queue', tracks: Array.from({ length: 1_001 }, () => track) })
    expect(client.error).toBe('')
    const command = socket.sent.find(message => message.type === 'command')
    expect(command).toMatchObject({ action: 'queue', tracks: [expect.objectContaining({ provider: track.provider, id: track.id })] })
    expect(command?.type === 'command' && command.tracks).toHaveLength(1)
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
it('lets a legacy BV entry establish P1 duration while preserving known CID and authoritative snapshot durations', () => {
  const legacy = { ...track, provider: 'bili' as const, id: 'BV1234567890', duration: 530118 }
  expect(publicTrack(legacy).duration).toBe(0)
  expect(publicTrack({ ...legacy, id: `${legacy.id}:123`, duration: 429 }).duration).toBe(429)
  expect(publicTrack({ ...legacy, duration: 429 }, { preserveDuration: true }).duration).toBe(429)
})


describe('hosted client source control', () => {
  const source = { mode: 'hosted' as const, version: 1, credential: 'ready' as const, label: '尾号 1234' }
  async function hostSource(patch: Partial<RoomSnapshot> = {}) {
    await socket.receive({ type: 'snapshot', snapshot: snapshot({ revision: 1, source, ...patch }) })
    await vi.advanceTimersByTimeAsync(0)
  }
  it('loads a private ticket URL without persisting it or sending it on the WebSocket', async () => {
    await connect()
    await hostSource()
    expect(playback.load).toHaveBeenLastCalledWith(track, 0, expect.any(AbortSignal), undefined, `http://localhost:3410/room-audio?ticket=${'a'.repeat(64)}`)
    expect(JSON.stringify(socket.sent)).not.toContain('room-audio')
    expect(JSON.stringify(persist.mock.calls)).not.toContain('room-audio')
  })
  it('preserves an explicit personal-source fallback across remote updates and stores only the preference', async () => {
    await connect()
    await hostSource()
    client.usePersonalSource(true)
    await vi.advanceTimersByTimeAsync(0)
    expect(playback.load).toHaveBeenLastCalledWith(track, 0, expect.any(AbortSignal), undefined, undefined)
    expect(persist).toHaveBeenLastCalledWith(expect.objectContaining({ personalSource: true }))
    roomRequest.mockClear()
    await hostSource({ revision: 2, source: { ...source, version: 2 } })
    expect(roomRequest).not.toHaveBeenCalled()
  })
  it('never silently falls back when the hosted source fails', async () => {
    await connect()
    vi.mocked(playback.load).mockClear()
    roomRequest.mockRejectedValueOnce(new Error('房间账号只能试听'))
    await hostSource()
    expect(client.status).toBe('failed')
    expect(client.personalSource).toBe(false)
    expect(playback.load).not.toHaveBeenCalled()
  })
  it('fetches a fresh ticket when the same track starts a new playback instance', async () => {
    await connect()
    await hostSource()
    roomRequest.mockClear()
    await hostSource({ revision: 2, playbackId: 'repeat' })
    expect(roomRequest).toHaveBeenCalledWith(expect.any(String), 'secret', expect.objectContaining({ action: 'ticket', playbackId: 'repeat' }), expect.any(AbortSignal))
  })
  it('renews a lease without changing the audio source or reloading media', async () => {
    await connect()
    await hostSource()
    vi.mocked(playback.load).mockClear()
    for (let elapsed = 0; elapsed < 60_000; elapsed += 5000) {
      await socket.receive({ type: 'pong', sentAt: performance.now(), serverTime: performance.now() })
      await vi.advanceTimersByTimeAsync(5000)
    }
    expect(roomRequest.mock.calls.some(call => call[2]?.action === 'renew')).toBe(true)
    expect(playback.load).not.toHaveBeenCalled()
  })
  it('cancels a late ticket response when media loading times out', async () => {
    await connect()
    vi.mocked(playback.load).mockClear()
    let finish!: (data: unknown) => void
    roomRequest.mockImplementationOnce(() => new Promise(resolve => { finish = resolve }))
    await hostSource()
    for (let elapsed = 0; elapsed < 21_000; elapsed += 5000) {
      await socket.receive({ type: 'pong', sentAt: performance.now(), serverTime: performance.now() })
      await vi.advanceTimersByTimeAsync(5000)
    }
    finish({ ticket: 'b'.repeat(64), leaseMs: 120_000 })
    await vi.advanceTimersByTimeAsync(0)
    expect(playback.load).not.toHaveBeenCalled()
    expect(client.status).toBe('failed')
  })
  it('source changes preserve active away intent instead of restarting audio', async () => {
    await connect()
    client.pauseLocal()
    vi.mocked(playback.load).mockClear()
    await hostSource()
    client.usePersonalSource(true)
    await vi.advanceTimersByTimeAsync(0)
    expect(client.away).toBe(true)
    expect(playback.load).not.toHaveBeenCalled()
    expect(playback.audio.paused).toBe(true)
  })
})


it.each(['netease', 'qq', 'bili'] as const)('sends explicit %s credential selection only through authenticated HTTP', async (provider) => {
  await connect('host')
  roomRequest.mockResolvedValueOnce({ ok: true })
  expect(await client.manageSource('credential', 'private-session', provider)).toBe(true)
  expect(roomRequest).toHaveBeenLastCalledWith('http://localhost:3410', 'secret', expect.objectContaining({ action: 'credential', provider, cookie: 'private-session' }), expect.any(AbortSignal))
  expect(JSON.stringify(socket.sent)).not.toContain('private-session')
  expect(JSON.stringify(persist.mock.calls)).not.toContain('private-session')
})

it('sends a platform-specific source setting without changing the other platforms', async () => {
  await connect('host')
  roomRequest.mockResolvedValueOnce({ ok: true })
  expect(await client.manageSource('source', 'hosted', 'qq')).toBe(true)
  expect(roomRequest).toHaveBeenLastCalledWith('http://localhost:3410', 'secret', expect.objectContaining({ action: 'source', provider: 'qq', mode: 'hosted' }), expect.any(AbortSignal))
  roomRequest.mockClear()
  expect(await client.manageSource('source', 'hosted')).toBe(false)
  expect(roomRequest).not.toHaveBeenCalled()
})

describe('administrator controls and room activity', () => {
  const members: RoomSnapshot['members'] = [{ id: 'host', name: 'Host', role: 'host', generation: 1, online: true, status: 'ready' }, { id: 'member', name: 'Admin', role: 'admin', generation: 1, online: true, status: 'ready' }]
  it('another platform account update does not reload or pause current anonymous audio', async () => {
    await connect()
    const source = { mode: 'hosted' as const, version: 1, provider: 'qq' as const, credential: 'none' as const, accounts: {} }
    await socket.receive({ type: 'snapshot', snapshot: snapshot({ revision: 1, status: 'playing', wantsToPlay: true, source }) })
    await vi.advanceTimersByTimeAsync(100)
    vi.mocked(playback.load).mockClear(); vi.mocked(playback.audio.pause).mockClear()
    await socket.receive({ type: 'snapshot', snapshot: snapshot({ revision: 1, status: 'playing', wantsToPlay: true, activityVersion: 1, source: { ...source, accounts: { netease: { credential: 'ready', version: 1, label: 'NetEase account' } } } }) })
    expect(playback.load).not.toHaveBeenCalled()
    expect(playback.audio.pause).not.toHaveBeenCalled()
    expect(playback.audio.paused).toBe(false)
    expect(client.snapshot?.source?.provider).toBe('qq')
    expect(client.snapshot?.source?.accounts?.netease?.credential).toBe('ready')
  })
  it('enables administrator controls immediately and clears queued controls on revocation', async () => {
    await connect()
    await socket.receive({ type: 'snapshot', snapshot: snapshot({ members, activityVersion: 1 }) })
    expect(client.canControl).toBe(true)
    client.control({ type: 'next', direction: 1 }); client.control({ type: 'seek', position: 25 })
    expect(socket.sent.filter(m => m.type === 'command')).toHaveLength(1)
    await socket.receive({ type: 'snapshot', snapshot: snapshot({ members: members.map(m => ({ ...m, role: m.id === 'host' ? 'host' : 'member' })), activityVersion: 2 }) })
    expect(client.canControl).toBe(false)
    expect(client.busy).toBe(false)
    client.control({ type: 'next', direction: 1 })
    expect(socket.sent.filter(m => m.type === 'command')).toHaveLength(1)
  })
  it('administrator play/pause affects the room, automatic ended stays host-only', async () => {
    await connect()
    await socket.receive({ type: 'snapshot', snapshot: snapshot({ members, activityVersion: 1 }) })
    client.control({ type: 'play', playing: false })
    expect(socket.sent.at(-1)).toMatchObject({ type: 'command', action: 'pause' })
    client.control({ type: 'ended' })
    expect(socket.sent.filter(m => m.type === 'command')).toHaveLength(1)
    expect(await client.manageSource('revoke')).toBe(false)
    expect(await client.setMemberRole('someone', 'admin')).toBe(false)
  })
  it('chat and role-only updates keep native audio and in-flight preparation untouched', async () => {
    await connect()
    await socket.receive({ type: 'snapshot', snapshot: snapshot({ revision: 1, status: 'playing', wantsToPlay: true }) })
    await vi.advanceTimersByTimeAsync(100)
    vi.mocked(playback.load).mockClear(); vi.mocked(playback.audio.pause).mockClear()
    await socket.receive({ type: 'snapshot', snapshot: snapshot({ revision: 1, status: 'playing', wantsToPlay: true, members, activityVersion: 2, history: [{ id: 2, at: Date.now(), kind: 'chat', name: 'Host', text: 'Hi' }] }) })
    expect(playback.load).not.toHaveBeenCalled()
    expect(playback.audio.pause).not.toHaveBeenCalled()
    expect(playback.audio.paused).toBe(false)
    expect(client.snapshot?.history.at(-1)?.text).toBe('Hi')
  })
  it('waits for chat acknowledgement, reports rejection, and retains the room connection', async () => {
    await connect()
    const sent = client.sendChat('  Hello  ')
    const message = socket.sent.at(-1) as Extract<ClientMessage, { type: 'chat' }>
    expect(message).toMatchObject({ type: 'chat', text: 'Hello' })
    expect(client.interactionBusy).toBe(true)
    await socket.receive({ type: 'ack', commandId: message.commandId, revision: 0 })
    expect(await sent).toBe(true)
    expect(client.interactionBusy).toBe(false)
    const denied = client.sendChat('Again')
    const next = socket.sent.at(-1) as typeof message
    await socket.receive({ type: 'error', code: 'rate-limit', message: '过于频繁', commandId: next.commandId })
    expect(await denied).toBe(false)
    expect(client.connection).toBe('connected')
    expect(client.error).toBe('过于频繁')
  })
  it('resolves uncertain sends on timeout/disconnect without automatically resending', async () => {
    await connect()
    const pending = client.sendChat('Maybe delivered')
    await vi.advanceTimersByTimeAsync(8500)
    expect(await pending).toBe(false)
    expect(client.error).toContain('确认超时')
    expect(socket.sent.filter(m => m.type === 'chat')).toHaveLength(1)
    const disconnected = client.sendChat('Not sure')
    socket.close()
    expect(await disconnected).toBe(false)
    expect(client.interactionBusy).toBe(false)
  })
  it('does not replace newer roles/history with an older same-revision HTTP response', async () => {
    await connect('host')
    let finish!: (value: unknown) => void
    roomRequest.mockImplementationOnce(() => new Promise(resolve => { finish = resolve }))
    const request = client.manageSource('revoke')
    await socket.receive({ type: 'snapshot', snapshot: snapshot({ activityVersion: 2, members, history: [{ id: 2, at: Date.now(), kind: 'chat', text: 'Latest' }] }) })
    finish({ ok: true, snapshot: snapshot({ activityVersion: 1, history: [] }) })
    expect(await request).toBe(true)
    expect(client.snapshot?.history[0]?.text).toBe('Latest')
    expect(client.snapshot?.members[1]?.role).toBe('admin')
  })
  it('preserves unchanged member and history objects across heartbeats and new activity', async () => {
    await connect()
    const history = [{ id: 1, at: Date.now(), kind: 'chat' as const, text: 'First' }]
    await socket.receive({ type: 'snapshot', snapshot: snapshot({ activityVersion: 1, members, history }) })
    const oldMember = client.snapshot!.members[1]
    const oldEntry = client.snapshot!.history[0]
    await socket.receive({ type: 'snapshot', snapshot: snapshot({ activityVersion: 1, members, history }) })
    expect(client.snapshot!.members[1]).toBe(oldMember)
    expect(client.snapshot!.history[0]).toBe(oldEntry)
    await socket.receive({ type: 'snapshot', snapshot: snapshot({ activityVersion: 2, members, history: [...history, { id: 2, at: Date.now(), kind: 'chat', text: 'Second' }] }) })
    expect(client.snapshot!.history[0]).toBe(oldEntry)
    expect(client.snapshot!.members[1]).toBe(oldMember)
    await socket.receive({ type: 'snapshot', snapshot: snapshot({ activityVersion: 3, members: members.map(m => ({ ...m, role: m.id === 'member' ? 'member' : 'host' })), history }) })
    expect(client.snapshot!.members[1]).not.toBe(oldMember)
    expect(client.canControl).toBe(false)
  })
})

describe('host sessions from current Provider settings', () => {
  const platforms = ['netease', 'qq', 'bili'] as const
  const hostedState = () => snapshot({ source: { mode: 'hosted', provider: 'netease', credential: 'none', version: 0, accounts: {}, modes: { netease: 'hosted', qq: 'hosted', bili: 'hosted' } } })
  async function setup(read: (platform: typeof platforms[number]) => Promise<string>, member = 'host') {
    client.dispose()
    client = new ListenClient(playback, () => {}, persist, exited, { platforms, read })
    let state = hostedState()
    roomRequest.mockImplementation(async (_server, _token, request) => {
      if (request.action === 'credential' || request.action === 'revoke') {
        const platform = request.provider!
        const affects = platform === state.source!.provider
        const credential = request.action === 'credential' ? 'ready' as const : 'none' as const
        state = { ...state, revision: state.revision + (affects ? 1 : 0), activityVersion: state.activityVersion + 1,
          source: { ...state.source!, version: state.source!.version + (affects ? 1 : 0), ...(affects ? { credential } : {}), accounts: { ...state.source!.accounts, [platform]: { credential, version: 1 } } } }
        return { ok: true, snapshot: state }
      }
      return { ticket: 'a'.repeat(64), leaseMs: 120_000 }
    })
    await connect(member, state)
    await vi.advanceTimersByTimeAsync(0)
  }
  const mutations = () => roomRequest.mock.calls.filter(([, , request]) => request.action === 'credential' || request.action === 'revoke')

  it('binds host sessions serially before media loading, leaving anonymous platforms hosted', async () => {
    const read = vi.fn(async (platform: typeof platforms[number]) => platform === 'bili' ? '' : `${platform}-session-secret`)
    await setup(read)
    expect(mutations().map(([, , request]) => request)).toMatchObject([
      { action: 'credential', provider: 'netease', cookie: 'netease-session-secret', expectedRevision: 0 },
      { action: 'credential', provider: 'qq', cookie: 'qq-session-secret', expectedRevision: 1 },
    ])
    expect(roomRequest.mock.calls.findIndex(([, , request]) => request.action === 'ticket')).toBeGreaterThan(1)
    expect(client.snapshot?.source?.modes?.bili).toBe('hosted')
    expect(JSON.stringify(socket.sent)).not.toContain('session-secret')
    expect(JSON.stringify(persist.mock.calls)).not.toContain('session-secret')
    await client.refreshHostedCredentials()
    expect(mutations()).toHaveLength(2)
  })

  it('never reads or uploads member sessions', async () => {
    const read = vi.fn(async () => 'member-private')
    await setup(read, 'member')
    await client.refreshHostedCredentials()
    expect(read).not.toHaveBeenCalled()
    expect(mutations()).toHaveLength(0)
  })

  it('revokes an old account when the active website session becomes anonymous without changing source mode', async () => {
    let cookie = 'host-session-secret'
    await setup(async platform => platform === 'netease' ? cookie : '')
    cookie = ''
    await client.refreshHostedCredentials(['netease'])
    await vi.advanceTimersByTimeAsync(0)
    expect(mutations().at(-1)![2]).toMatchObject({ action: 'revoke', provider: 'netease' })
    expect(client.snapshot?.source).toMatchObject({ mode: 'hosted', credential: 'none', modes: { netease: 'hosted' } })
  })

  it('blocks the active source after session refresh fails instead of reusing the old bound account', async () => {
    let invalid = false
    await setup(async platform => { if (platform === 'netease' && invalid) throw new Error('请更新音源设置'); return platform === 'netease' ? 'host-session-secret' : '' })
    roomRequest.mockClear(); playback.load = vi.fn()
    invalid = true
    await client.refreshHostedCredentials(['netease'])
    await vi.advanceTimersByTimeAsync(0)
    expect(client.hostedCredentialErrors.netease).toBe('请更新音源设置')
    expect(client.status).toBe('failed')
    expect(playback.audio.paused).toBe(true)
    expect(playback.load).not.toHaveBeenCalled()
    expect(roomRequest.mock.calls.some(([, , request]) => request.action === 'ticket')).toBe(false)
  })

  it('does not reload the active source while another platform account changes', async () => {
    let qq = 'qq-session-secret'
    await setup(async platform => platform === 'qq' ? qq : '')
    vi.mocked(playback.load).mockClear(); vi.mocked(playback.cancelLoad).mockClear()
    qq = 'qq-new-session-secret'
    await client.refreshHostedCredentials(['qq'])
    expect(playback.cancelLoad).not.toHaveBeenCalled()
    expect(playback.load).not.toHaveBeenCalled()
  })
  it('keeps a room-specific Cookie across global setting changes until explicitly following settings again', async () => {
    const read = vi.fn(async (platform: typeof platforms[number]) => platform === 'netease' ? 'settings-session-secret' : '')
    await setup(read)
    expect(await client.manageSource('credential', 'room-only-session-secret', 'netease')).toBe(true)
    expect(client.hostedCredentialOverrides).toEqual(['netease'])
    expect(persist).toHaveBeenLastCalledWith(expect.objectContaining({ sourceOverrides: ['netease'] }))
    expect(JSON.stringify(persist.mock.calls)).not.toContain('room-only-session-secret')
    read.mockClear(); roomRequest.mockClear()
    await client.refreshHostedCredentials(['netease'])
    expect(read).not.toHaveBeenCalled()
    expect(mutations()).toHaveLength(0)
    await client.useSettingsCredentials(['netease'])
    expect(client.hostedCredentialOverrides).toEqual([])
    expect(mutations().at(-1)![2]).toMatchObject({ action: 'credential', provider: 'netease', cookie: 'settings-session-secret' })
  })
  it('retains an explicit room account revocation as anonymous hosting instead of rebinding global settings', async () => {
    await setup(async platform => platform === 'netease' ? 'settings-session-secret' : '')
    await client.manageSource('revoke', undefined, 'netease')
    roomRequest.mockClear()
    await client.refreshHostedCredentials(['netease'])
    expect(mutations()).toHaveLength(0)
    expect(client.snapshot?.source).toMatchObject({ mode: 'hosted', credential: 'none' })
    expect(client.hostedCredentialOverrides).toEqual(['netease'])
  })
  it('restores only the room override flags after refresh, never the room Cookie', async () => {
    await setup(async () => '')
    await client.manageSource('credential', 'room-only-session-secret', 'netease')
    const identity = structuredClone(persist.mock.calls.at(-1)![0]!)
    const state = client.snapshot!
    client.dispose()
    const read = vi.fn(async (_platform: typeof platforms[number]) => '')
    client = new ListenClient(playback, () => {}, persist, exited, { platforms, read })
    roomRequest.mockClear()
    await client.resume(identity)
    socket = Socket.all.at(-1)!; socket.onopen?.()
    await socket.receive({ type: 'welcome', token: 'secret', memberId: 'host', generation: 2, snapshot: state })
    await vi.advanceTimersByTimeAsync(0)
    expect(client.hostedCredentialOverrides).toEqual(['netease'])
    expect(read.mock.calls.some(([platform]) => platform === 'netease')).toBe(false)
    expect(mutations()).toHaveLength(0)
    expect(JSON.stringify(identity)).not.toContain('room-only-session-secret')
  })
  it('defers automatic track advance while refreshing another platform session instead of dropping it', async () => {
    let release!: (cookie: string) => void
    const pending = new Promise<string>(resolve => { release = resolve })
    let waiting = false
    await setup(async platform => platform === 'qq' && waiting ? pending : '')
    waiting = true
    const refresh = client.refreshHostedCredentials(['qq'])
    client.control({ type: 'ended' })
    expect(socket.sent.some(message => message.type === 'command' && message.action === 'ended')).toBe(false)
    release(''); await refresh
    expect(socket.sent.some(message => message.type === 'command' && message.action === 'ended')).toBe(true)
  })
})
