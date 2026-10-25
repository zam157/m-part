import { HostedSourceError } from '../server/providers/shared'
import { createQQHostedProvider } from '../server/providers/qq'
import { createBiliHostedProvider } from '../server/providers/bilibili'
import type { ServerMessage, RoomControl, RoomTicket } from '@m-part/listen-core/protocol'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { LISTEN_PROTOCOL, roomTicket, serverMessage } from '@m-part/listen-core/protocol'
import * as v from 'valibot'
import { ListenRooms } from '../server/utils/listen-rooms'
import { HostedMedia } from '../server/utils/hosted-media'
import { parseNeteaseCookie, validateNeteaseMediaUrl } from '../server/providers/netease'
import { createRoomControlHandler, credentialTransportAllowed } from '../server/utils/room-http'

const cookie = 'MUSIC_U=abcdefghijklmnop123456; __csrf=0123456789abcdef; irrelevant=must-not-forward'
const track = { provider: 'netease' as const, id: '123', title: 'Song', duration: 120, coverUrl: '' }
const source = { url: 'https://m1.music.126.net/file.mp3', hash: 'a'.repeat(32), size: 10 }
const peer = (id: string) => ({ id, messages: [] as ServerMessage[], send(message: ServerMessage) { this.messages.push(structuredClone(message)) }, close: vi.fn() })
let rooms: ListenRooms
let media: HostedMedia
let host: ReturnType<typeof peer>
let member: ReturnType<typeof peer>
let now: number
const provider = { parseCookie: parseNeteaseCookie, validateMediaUrl: validateNeteaseMediaUrl, validate: vi.fn(), resolve: vi.fn() }
const fetcher = vi.fn<typeof fetch>()
const state = (p = host) => (p.messages.findLast(m => m.type === 'snapshot' || m.type === 'welcome') as Extract<ServerMessage, { type: 'snapshot' | 'welcome' }>).snapshot
const token = (p = host) => (p.messages.find(m => m.type === 'welcome') as Extract<ServerMessage, { type: 'welcome' }>).token
const signal = () => new AbortController().signal
const mutation = (action: 'revoke' | 'retry-source'): RoomControl => action === 'revoke' ? { action, provider: 'netease', roomId: state().roomId, expectedRevision: state().revision } : { action, roomId: state().roomId, expectedRevision: state().revision }
async function enableHosted() { await media.control(token(), { action: 'source', mode: 'hosted', roomId: state().roomId, expectedRevision: state().revision }, signal()) }
async function bind() { await media.control(token(), { action: 'credential', cookie, roomId: state().roomId, expectedRevision: state().revision }, signal()); await enableHosted() }
async function ticket(p = host) {
  const current = state(p)
  return v.parse(roomTicket, await media.control(token(p), { action: 'ticket', roomId: current.roomId, sourceVersion: current.source!.version, queueItemId: current.queue[current.currentIndex!]!.queueItemId, playbackId: current.playbackId }, signal()))
}
function audio(lease: RoomTicket, range?: string, requestSignal?: AbortSignal) {
  return media.audio(new Request('https://rooms.example/room-audio', { headers: range ? { range } : {}, signal: requestSignal }), lease.ticket)
}
function advance(ms: number) {
  const end = now + ms
  while (now < end) {
    now = Math.min(end, now + 10_000)
    for (const p of [host, member]) rooms.receive(p, { type: 'ping', sentAt: now })
  }
}

beforeEach(() => {
  now = 0
  provider.validate.mockReset().mockResolvedValue('网易云账号 · 尾号 1234')
  provider.resolve.mockReset().mockResolvedValue({ ...source })
  fetcher.mockReset().mockImplementation(async (_url, options) => {
    const range = new Headers(options?.headers).get('range')
    const headers: Record<string, string> = { 'content-type': 'audio/mpeg', 'accept-ranges': 'bytes' }
    let first = 0; let last = 9
    if (range) {
      const match = /^bytes=(\d*)-(\d*)$/.exec(range)!
      first = match[1] ? Number(match[1]) : Math.max(0, 10 - Number(match[2]))
      last = match[1] && match[2] ? Math.min(Number(match[2]), 9) : 9
      if (first >= 10 || first > last) return new Response(null, { status: 416, headers: { ...headers, 'content-range': 'bytes */10' } })
      headers['content-range'] = `bytes ${first}-${last}/10`
    }
    const data = new TextEncoder().encode('abcdefghij'.slice(first, last + 1))
    headers['content-length'] = String(data.byteLength)
    return new Response(data, { status: range ? 206 : 200, headers })
  })
  rooms = new ListenRooms(() => now, s => media.sync(s))
  media = new HostedMedia(rooms, { netease: provider, qq: provider, bili: provider }, fetcher, () => now)
  host = peer('host'); member = peer('member')
  rooms.receive(host, { type: 'create', protocol: LISTEN_PROTOCOL, kind: 'music', name: 'Host', tracks: [track, { ...track, id: '456' }], autoplay: true })
  rooms.receive(member, { type: 'join', protocol: LISTEN_PROTOCOL, kind: 'music', name: 'Member', code: state().code })
})

describe('hosted room credentials and media leases', () => {
  it('logs rejected CDN requests with status and phase without leaking tickets or upstream URLs', async () => {
    const output = vi.spyOn(console, 'error').mockImplementation(() => {})
    try {
      await bind()
      const lease = await ticket()
      fetcher.mockResolvedValue(new Response(null, { status: 403 }))
      expect((await audio(lease)).status).toBe(502)
      const entries = output.mock.calls.map(call => JSON.parse(String(call[1])))
      expect(entries).toEqual([
        expect.objectContaining({ operation: 'media.refresh', phase: 'cdn', provider: 'netease', httpStatus: 403 }),
        expect.objectContaining({ operation: 'media.response', phase: 'cdn', provider: 'netease', httpStatus: 403 }),
      ])
      for (const secret of [cookie, lease.ticket, source.url]) expect(JSON.stringify(output.mock.calls)).not.toContain(secret)
    }
    finally { output.mockRestore() }
  })

  it('explicitly binds only allowlisted cookies and broadcasts no secrets, URLs or tickets', async () => {
    await bind()
    expect(provider.validate).toHaveBeenCalledWith('MUSIC_U=abcdefghijklmnop123456; __csrf=0123456789abcdef;', expect.any(AbortSignal))
    const lease = await ticket()
    expect(state().source).toMatchObject({ mode: 'hosted', credential: 'ready', ownerId: rooms.authorize(token(), state().roomId).memberId })
    const snapshots = host.messages.filter(m => m.type === 'snapshot')
    const serialized = JSON.stringify(snapshots)
    for (const secret of [cookie, 'abcdefghijklmnop123456', source.url, lease.ticket]) expect(serialized).not.toContain(secret)
    for (const message of host.messages) expect(v.safeParse(serverMessage, message).success).toBe(true)
  })

  it.each(['credential', 'source', 'revoke', 'retry-source'] as const)('denies member credential management: %s', async (action) => {
    const request = { action, roomId: state().roomId, expectedRevision: state().revision, cookie, mode: 'hosted' } as RoomControl
    await expect(media.control(token(member), request, signal())).rejects.toThrow('仅房主')
    expect(provider.validate).not.toHaveBeenCalled()
  })

  it('merges source resolution for simultaneous members without merging their private leases', async () => {
    await bind()
    const [a, b] = await Promise.all([ticket(), ticket(member)])
    expect(provider.resolve).toHaveBeenCalledOnce()
    expect(a.ticket).not.toBe(b.ticket)
    await expect(media.control(token(member), { action: 'renew', roomId: state().roomId, ticket: a.ticket }, signal())).rejects.toThrow('失效')
  })

  it('rejects expired and renewed leases correctly while room heartbeats remain healthy', async () => {
    await bind()
    const a = await ticket()
    const b = await ticket(member)
    advance(60_000)
    await media.control(token(), { action: 'renew', roomId: state().roomId, ticket: a.ticket }, signal())
    advance(70_000)
    expect((await audio(a)).status).toBe(200)
    expect((await audio(b)).status).toBe(401)
  })

  it('revocation invalidates credential media and prepares anonymous playback without changing the mode', async () => {
    await bind()
    const lease = await ticket(member)
    await media.control(token(), mutation('revoke'), signal())
    expect(state()).toMatchObject({ status: 'preparing', wantsToPlay: true, source: { mode: 'hosted', credential: 'none' } })
    expect((await audio(lease)).status).toBe(401)
    await ticket(); expect(provider.resolve).toHaveBeenLastCalledWith('', track.id, expect.any(AbortSignal))
  })

  it.each(['switch', 'track', 'end', 'reconnect'] as const)('invalidates old tickets after %s', async (action) => {
    await bind()
    const lease = await ticket(member)
    if (action === 'switch') await media.control(token(), { action: 'source', mode: 'independent', roomId: state().roomId, expectedRevision: state().revision }, signal())
    if (action === 'track') rooms.receive(host, { type: 'command', commandId: 'next', expectedRevision: state().revision, action: 'next' })
    if (action === 'end') rooms.receive(host, { type: 'leave' })
    if (action === 'reconnect') rooms.receive(peer('new-member'), { type: 'resume', protocol: LISTEN_PROTOCOL, token: token(member) })
    expect((await audio(lease)).status).toBe(401)
  })

  it('cancels a departing member stream without stopping the other members', async () => {
    await bind()
    const [a, b] = await Promise.all([ticket(), ticket(member)])
    const cancelled = vi.fn()
    fetcher.mockResolvedValueOnce(new Response(new ReadableStream({ start(c) { c.enqueue(new Uint8Array([1])) }, cancel: cancelled }), { headers: { 'content-type': 'audio/mpeg' } }))
    const response = await audio(b)
    const reader = response.body!.getReader()
    await reader.read()
    const waiting = reader.read()
    rooms.receive(member, { type: 'leave' })
    await expect(waiting).rejects.toThrow('取消')
    expect(cancelled).toHaveBeenCalledOnce()
    expect((await audio(a)).status).toBe(200)
  })

  it('client cancellation releases the upstream stream and does not pause the room', async () => {
    await bind()
    const lease = await ticket()
    const cancelled = vi.fn()
    fetcher.mockResolvedValueOnce(new Response(new ReadableStream({ start(c) { c.enqueue(new Uint8Array([1])) }, cancel: cancelled }), { headers: { 'content-type': 'audio/mpeg' } }))
    const response = await audio(lease)
    await response.body!.cancel()
    expect(cancelled).toHaveBeenCalled()
    expect(state().source?.error).toBeUndefined()
  })

  it('a member leaving while CDN headers are pending does not fail the shared source', async () => {
    await bind()
    const lease = await ticket(member)
    fetcher.mockImplementationOnce((_url, options) => new Promise((_, reject) => {
      options!.signal!.addEventListener('abort', () => reject(options!.signal!.reason), { once: true })
    }))
    const waiting = audio(lease)
    rooms.receive(member, { type: 'leave' })
    expect((await waiting).status).toBe(502)
    expect(state().source?.error).toBeUndefined()
    expect((await audio(await ticket())).status).toBe(200)
  })

  it.each(['bytes=0-0', 'bytes=3-', 'bytes=-3'])('preserves valid range semantics: %s', async (range) => {
    await bind()
    const lease = await ticket()
    const response = await audio(lease, range)
    expect(response.status).toBe(206)
    expect(response.headers.get('content-range')).toMatch(/^bytes \d+-\d+\/10$/)
    expect((await response.arrayBuffer()).byteLength).toBe(Number(response.headers.get('content-length')))
    const headers = new Headers(fetcher.mock.calls[0]![1]?.headers)
    expect(headers.get('range')).toBe(range)
    expect(headers.has('cookie')).toBe(false)
    expect(headers.has('authorization')).toBe(false)
  })

  it('preserves upstream 416 without inventing a partial response or a global failure', async () => {
    await bind()
    const response = await audio(await ticket(), 'bytes=30-')
    expect(response.status).toBe(416)
    expect(response.headers.get('content-range')).toBe('bytes */10')
    expect(state().source?.error).toBeUndefined()
  })

  it('never fakes 206 when an upstream server ignores Range', async () => {
    await bind()
    fetcher.mockResolvedValueOnce(new Response(new Uint8Array(10), { headers: { 'content-type': 'audio/mpeg', 'content-length': '10' } }))
    const response = await audio(await ticket(), 'bytes=2-')
    expect(response.status).toBe(200)
    expect(response.headers.get('accept-ranges')).toBe('none')
    expect(response.headers.has('content-range')).toBe(false)
  })

  it('rejects mismatched ranges', async () => {
    await bind()
    fetcher.mockResolvedValueOnce(new Response(new Uint8Array(2), { status: 206, headers: { 'content-type': 'audio/mpeg', 'content-range': 'bytes 5-6/10', 'content-length': '2' } }))
    expect((await audio(await ticket(), 'bytes=0-1')).status).toBe(502)
    expect(state()).toMatchObject({ status: 'paused', wantsToPlay: false })
    expect(state().source?.error).toContain('Range')
  })

  it.each<Record<string, string>>([
    { 'content-encoding': 'gzip' },
    { 'content-length': String(65 * 1024 * 1024) },
  ])('rejects encoded or oversized media before streaming: %j', async (headers) => {
    await bind()
    fetcher.mockResolvedValueOnce(new Response(null, { headers: { 'content-type': 'audio/mpeg', ...headers } }))
    expect((await audio(await ticket())).status).toBe(502)
    expect(state().source?.error).toBeDefined()
  })

  it('rejects a partial body that is shorter than its advertised range even without Content-Length', async () => {
    await bind()
    fetcher.mockResolvedValueOnce(new Response(new Uint8Array(1), { status: 206, headers: { 'content-type': 'audio/mpeg', 'content-range': 'bytes 0-2/10' } }))
    const response = await audio(await ticket(), 'bytes=0-2')
    await expect(response.arrayBuffer()).rejects.toThrow('传输失败')
    expect(state().source?.error).toContain('长度不完整')
  })

  it('refreshes expired signed URLs only when file hash and length remain identical', async () => {
    await bind()
    const lease = await ticket()
    fetcher.mockResolvedValueOnce(new Response(null, { status: 403 }))
    provider.resolve.mockResolvedValueOnce({ ...source, url: 'https://m2.music.126.net/refreshed.mp3' })
    const response = await audio(lease, 'bytes=0-0')
    expect(response.status).toBe(206)
    expect(fetcher.mock.calls[1]?.[0]).toContain('refreshed.mp3')
  })

  it('stops after a changed signed resource instead of stitching together different files', async () => {
    await bind()
    const lease = await ticket()
    fetcher.mockResolvedValueOnce(new Response(null, { status: 410 }))
    provider.resolve.mockResolvedValueOnce({ ...source, hash: 'b'.repeat(32) })
    expect((await audio(lease)).status).toBe(502)
    expect(fetcher).toHaveBeenCalledOnce()
    expect(state().source?.error).toContain('内容已变化')
  })

  it('stops failed upstream resolution until the host explicitly retries', async () => {
    await bind()
    provider.resolve.mockRejectedValueOnce(new HostedSourceError('房间账号只能试听'))
    await expect(ticket()).rejects.toThrow('试听')
    await expect(ticket(member)).rejects.toThrow('试听')
    expect(provider.resolve).toHaveBeenCalledOnce()
    const old = state().source!.version
    await media.control(token(), mutation('retry-source'), signal())
    expect(state().source!.version).toBeGreaterThan(old)
    expect((await ticket()).ticket).toHaveLength(64)
  })

  it('rejects stale asynchronous credential binding after the timeline changed', async () => {
    let finish!: (value: string) => void
    provider.validate.mockImplementationOnce(() => new Promise(resolve => { finish = resolve }))
    const binding = bind()
    rooms.receive(host, { type: 'command', action: 'pause', expectedRevision: state().revision, commandId: 'pause' })
    finish('尾号 1234')
    await expect(binding).rejects.toThrow('状态已更新')
    expect(state().source?.credential).toBe('none')
  })

  it('aborts obsolete in-flight source resolution as soon as the host revokes access', async () => {
    await bind()
    let pendingSignal: AbortSignal | undefined
    provider.resolve.mockImplementationOnce((_cookie, _id, signal: AbortSignal) => new Promise((_, reject) => { pendingSignal = signal; signal.addEventListener('abort', () => reject(signal.reason), { once: true }) }))
    const pending = ticket()
    await media.control(token(), mutation('revoke'), signal())
    await expect(pending).rejects.toBeDefined()
    expect(pendingSignal?.aborted).toBe(true)
  })

  it('does not let a pending credential binding from the replaced connection commit', async () => {
    let finish!: (value: string) => void
    provider.validate.mockImplementationOnce(() => new Promise(resolve => { finish = resolve }))
    const pending = bind()
    rooms.receive(peer('new-host'), { type: 'resume', protocol: LISTEN_PROTOCOL, token: token() })
    finish('尾号 1234')
    await expect(pending).rejects.toThrow('状态已更新')
    expect(rooms.authorize(token(), state().roomId).snapshot.source?.credential).toBe('none')
  })

  it('does not issue a new-generation ticket to an old in-flight connection', async () => {
    await bind()
    let finish!: (value: typeof source) => void
    provider.resolve.mockImplementationOnce(() => new Promise(resolve => { finish = resolve }))
    const pending = ticket(member)
    rooms.receive(peer('new-member'), { type: 'resume', protocol: LISTEN_PROTOCOL, token: token(member) })
    finish(source)
    await expect(pending).rejects.toThrow('音源已更新')
  })

  it('rejects CDN redirects to local addresses and never exposes their targets', async () => {
    await bind()
    const lease = await ticket()
    fetcher.mockResolvedValueOnce(new Response(null, { status: 302, headers: { location: 'http://127.0.0.1/private' } }))
    expect((await audio(lease)).status).toBe(502)
    expect(fetcher).toHaveBeenCalledOnce()
    expect(JSON.stringify(state())).not.toContain('/private')
  })
})

describe('room HTTP authentication and credential transport', () => {
  const origin = `chrome-extension://${'a'.repeat(32)}`
  const handler = () => createRoomControlHandler(media)
  const request = (body: unknown, extra: RequestInit = {}) => new Request('http://127.0.0.1:3410/room-control', { method: 'POST', headers: { origin, authorization: `Bearer ${token()}`, 'content-type': 'application/json' }, body: JSON.stringify(body), ...extra })
  it('allows preflights and missing Origin by default but rejects invalid tokens and extra fields', async () => {
    expect((await handler()(new Request('http://127.0.0.1/room-control', { method: 'OPTIONS', headers: { origin } }))).status).toBe(204)
    expect((await handler()(request(mutation('revoke'), { headers: { authorization: `Bearer ${token()}` } }))).status).toBe(200)
    expect((await handler()(request({}, { headers: { origin, authorization: 'Bearer invalid' } }))).status).toBe(401)
    const response = await handler()(request({ ...mutation('revoke'), url: 'http://127.0.0.1/' }))
    expect(response.status).toBe(400)
    expect(await response.text()).not.toContain('127.0.0.1')
  })
  it('allows credentials over HTTPS or loopback HTTP, and supports an explicit TLS terminator', () => {
    expect(credentialTransportAllowed('https://rooms.example')).toBe(true)
    expect(credentialTransportAllowed('http://127.0.0.1:3410')).toBe(true)
    expect(credentialTransportAllowed('http://192.168.1.10:3410')).toBe(false)
    expect(credentialTransportAllowed('http://192.168.1.10:3410', 'https://rooms.example')).toBe(true)
  })
  it('lets the host bind and use hosted media without server opt-in', async () => {
    expect(state().source?.mode).toBe('independent')
    const response = await handler()(request({ action: 'credential', cookie, roomId: state().roomId, expectedRevision: state().revision }))
    expect(response.status).toBe(200)
    expect(provider.validate).toHaveBeenCalledOnce()
    expect(state().source).toMatchObject({ mode: 'independent', credential: 'ready' })
    await enableHosted()
    const current = state()
    const leased = await handler()(request({ action: 'ticket', roomId: current.roomId, queueItemId: current.queue[0]!.queueItemId, playbackId: current.playbackId, sourceVersion: current.source!.version }))
    expect(leased.status).toBe(200)
    expect((await audio(v.parse(roomTicket, await leased.json()))).status).toBe(200)
  })
})


describe('platform-specific room sessions', () => {
  it.each(['qq', 'bili'] as const)('binds %s, isolates CDN policies and replaces the previous private session', async (platform) => {
    await bind()
    const old = await ticket(member)
    const adapter = platform === 'qq' ? createQQHostedProvider() : createBiliHostedProvider()
    const resolve = vi.fn().mockResolvedValue({ url: platform === 'qq' ? 'https://isure.stream.qqmusic.qq.com/audio.m4a' : 'https://upos.bilivideo.com/audio.m4s' })
    const alternate = { ...adapter, validate: vi.fn().mockResolvedValue(`${platform} · 尾号 1234`), resolve }
    // Same service/state, different injected adapter registry for this isolated case.
    media = new HostedMedia(rooms, { netease: provider, qq: alternate, bili: alternate }, fetcher, () => now)
    media.sync(state())
    rooms.receive(host, { type: 'command', commandId: 'new-platform', expectedRevision: state().revision, action: 'queue', tracks: [{ ...track, provider: platform, id: platform === 'qq' ? '003rJSwm3TechU' : 'BV1234567890' }] })
    const supplied = platform === 'qq' ? 'qqmusic_uin=12345678; qqmusic_key=abcdefghijklmnop; MUSIC_U=not-forwarded' : 'SESSDATA=abcdefghijklmnop; MUSIC_U=not-forwarded'
    await media.control(token(), { action: 'credential', provider: platform, cookie: supplied, roomId: state().roomId, expectedRevision: state().revision }, signal())
    expect(state().source).toMatchObject({ provider: platform, mode: 'hosted', credential: 'ready' })
    expect(alternate.validate.mock.calls[0]?.[0]).not.toContain('MUSIC_U')
    const lease = await ticket(member)
    const response = await media.audio(new Request('https://rooms.example/room-audio', { headers: { range: 'bytes=2-5', cookie: 'browser-secret', authorization: 'browser-auth' } }), lease.ticket)
    expect(await response.text()).toBe('cdef')
    const headers = new Headers(fetcher.mock.calls.at(-1)?.[1]?.headers)
    expect(headers.has('cookie')).toBe(false)
    expect(headers.has('authorization')).toBe(false)
    expect(headers.get('referer')).toBe(platform === 'qq' ? 'https://y.qq.com/' : 'https://www.bilibili.com/')
    expect((await audio(old)).status).toBe(401)
    expect(provider.resolve).toHaveBeenCalledTimes(1)
    expect(resolve).toHaveBeenCalledTimes(1)
    const snapshots = JSON.stringify(member.messages)
    expect(snapshots).not.toContain('abcdefghijklmnop')
    expect(snapshots).not.toContain(lease.ticket)
    for (const message of member.messages) expect(v.safeParse(serverMessage, message).success).toBe(true)
  })

  it('uses anonymous QQ playback in a mixed queue without sending the NetEase account', async () => {
    await bind()
    rooms.receive(host, { type: 'command', commandId: 'mixed', expectedRevision: state().revision, action: 'queue', tracks: [{ ...track, provider: 'qq', id: '003rJSwm3TechU' }] })
    await ticket()
    expect(provider.resolve).toHaveBeenLastCalledWith('', '003rJSwm3TechU', expect.any(AbortSignal))
    expect(state().source).toMatchObject({ provider: 'qq', credential: 'none', accounts: { netease: { credential: 'ready' } } })
  })

  it('binding another platform preserves the current stream and both accounts', async () => {
    const alternate = { ...createQQHostedProvider(), validate: vi.fn().mockResolvedValue('QQ 音乐 · 尾号 5678'), resolve: vi.fn() }
    media = new HostedMedia(rooms, { netease: provider, qq: alternate, bili: provider }, fetcher, () => now)
    media.sync(state())
    await bind()
    const lease = await ticket(member)
    const revision = state().revision; const version = state().source!.version
    await media.control(token(), { action: 'credential', provider: 'qq', cookie: 'uin=12345678; skey=abcdefghijklmnop', roomId: state().roomId, expectedRevision: revision }, signal())
    expect(state().revision).toBe(revision); expect(state().source!.version).toBe(version)
    expect(await (await audio(lease)).text()).toBe('abcdefghij')
    expect(state().source?.accounts).toMatchObject({ netease: { credential: 'ready' }, qq: { credential: 'ready' } })
    expect(alternate.resolve).not.toHaveBeenCalled()
    await media.control(token(), { action: 'revoke', provider: 'qq', roomId: state().roomId, expectedRevision: revision }, signal())
    expect(state().revision).toBe(revision)
    expect((await audio(lease)).status).toBe(200)
  })

  it('accepts MP4 only for a BiliBili audio resource, never for NetEase', async () => {
    const alternate = { ...createBiliHostedProvider(), validate: vi.fn().mockResolvedValue('BiliBili · 尾号 5678'), resolve: vi.fn().mockResolvedValue({ url: 'https://upos.bilivideo.com/audio.m4s' }) }
    media = new HostedMedia(rooms, { netease: provider, qq: provider, bili: alternate }, fetcher, () => now)
    media.sync(state())
    await bind()
    fetcher.mockResolvedValue(new Response('audio', { headers: { 'content-type': 'video/mp4' } }))
    expect((await audio(await ticket())).status).toBe(502)
    rooms.receive(host, { type: 'command', commandId: 'bili', expectedRevision: state().revision, action: 'queue', tracks: [{ ...track, provider: 'bili', id: 'BV1234567890' }] })
    await media.control(token(), { action: 'credential', provider: 'bili', cookie: 'SESSDATA=abcdefghijklmnop', roomId: state().roomId, expectedRevision: state().revision }, signal())
    fetcher.mockResolvedValue(new Response('audio', { headers: { 'content-type': 'video/mp4' } }))
    const response = await audio(await ticket())
    expect(response.status).toBe(200)
    expect(await response.text()).toBe('audio')
  })
})

describe('optional per-platform room credentials', () => {
  const platforms = ['netease', 'qq', 'bili'] as const
  const adapters = Object.fromEntries(platforms.map(platform => [platform, { ...provider, parseCookie: (value: string) => value, validate: vi.fn(), resolve: vi.fn() }])) as Record<typeof platforms[number], typeof provider>
  const bindAccount = (platform: typeof platforms[number]) => media.control(token(), { action: 'credential', provider: platform, cookie: `${platform}-private`, roomId: state().roomId, expectedRevision: state().revision }, signal())
  const choose = (platform: typeof platforms[number]) => rooms.receive(host, { type: 'command', commandId: crypto.randomUUID(), expectedRevision: state().revision, action: 'queue', tracks: [{ ...track, provider: platform, id: platform === 'netease' ? '123' : platform === 'qq' ? '003rJSwm3TechU' : 'BV1234567890' }] })
  beforeEach(() => {
    for (const platform of platforms) {
      adapters[platform].validate.mockReset().mockResolvedValue(`${platform} account`)
      adapters[platform].resolve.mockReset().mockResolvedValue({ ...source })
    }
    media = new HostedMedia(rooms, adapters, fetcher, () => now); media.sync(state())
  })
  it('allows every platform to resolve anonymously with no accounts at all', async () => {
    await enableHosted()
    for (const platform of platforms) {
      choose(platform); await ticket()
      expect(adapters[platform].resolve).toHaveBeenCalledWith('', expect.any(String), expect.any(AbortSignal))
      expect(adapters[platform].validate).not.toHaveBeenCalled()
    }
    expect(state().source?.accounts).toEqual({})
  })
  it('keeps all three accounts, picks only the matching cookie and scopes revocation', async () => {
    for (const platform of platforms) await bindAccount(platform)
    expect(state().source?.mode).toBe('independent')
    await enableHosted()
    for (const platform of platforms) {
      choose(platform); await ticket()
      expect(adapters[platform].resolve).toHaveBeenLastCalledWith(`${platform}-private`, expect.any(String), expect.any(AbortSignal))
      expect(state().source).toMatchObject({ provider: platform, credential: 'ready' })
    }
    const lease = await ticket(); const revision = state().revision; const version = state().source!.version
    await media.control(token(), { action: 'revoke', provider: 'netease', roomId: state().roomId, expectedRevision: revision }, signal())
    expect(state().revision).toBe(revision); expect(state().source!.version).toBe(version)
    expect((await audio(lease)).status).toBe(200)
    expect(state().source?.accounts).toMatchObject({ netease: { credential: 'none' }, qq: { credential: 'ready' }, bili: { credential: 'ready' } })
    expect(JSON.stringify(state())).not.toContain('-private')
    choose('netease'); await ticket()
    expect(adapters.netease.resolve).toHaveBeenLastCalledWith('', '123', expect.any(AbortSignal))
  })
  it('replacing the current platform aborts its old stream and uses the new cookie', async () => {
    await bindAccount('netease'); await enableHosted()
    const lease = await ticket()
    const stream = await audio(lease)
    await media.control(token(), { action: 'credential', provider: 'netease', cookie: 'replacement-private', roomId: state().roomId, expectedRevision: state().revision }, signal())
    await expect(stream.text()).rejects.toThrow()
    expect((await audio(lease)).status).toBe(401)
    await ticket()
    expect(adapters.netease.resolve).toHaveBeenLastCalledWith('replacement-private', '123', expect.any(AbortSignal))
  })
  it('an expired NetEase account cannot invalidate QQ or BiliBili and NetEase can retry anonymously', async () => {
    for (const platform of platforms) await bindAccount(platform)
    await enableHosted()
    adapters.netease.resolve.mockRejectedValueOnce(new HostedSourceError('网易云凭据失效', true))
    await expect(ticket()).rejects.toThrow('失效')
    expect(state().source?.accounts).toMatchObject({ netease: { credential: 'invalid' }, qq: { credential: 'ready' }, bili: { credential: 'ready' } })
    choose('qq'); await ticket()
    expect(state().source?.error).toBeUndefined()
    expect(adapters.qq.resolve).toHaveBeenLastCalledWith('qq-private', expect.any(String), expect.any(AbortSignal))
    choose('netease'); await ticket()
    expect(adapters.netease.resolve).toHaveBeenLastCalledWith('', '123', expect.any(AbortSignal))
  })
  it('revokes a pending platform binding without interrupting another platform or accepting the late result', async () => {
    choose('qq'); await enableHosted(); const lease = await ticket()
    let finish!: (label: string) => void
    adapters.netease.validate.mockImplementationOnce(() => new Promise(resolve => { finish = resolve }))
    const pending = bindAccount('netease'); const assertion = expect(pending).rejects.toThrow()
    await media.control(token(), { action: 'revoke', provider: 'netease', roomId: state().roomId, expectedRevision: state().revision }, signal())
    finish('late label'); await assertion
    expect(state().source?.accounts?.netease?.credential).toBe('none')
    expect((await audio(lease)).status).toBe(200)
  })
  it('ignores late failures from a previous platform and playback instance', async () => {
    await bindAccount('netease'); await enableHosted()
    let fail!: (error: Error) => void
    adapters.netease.resolve.mockImplementationOnce(() => new Promise((_, reject) => { fail = reject }))
    const old = ticket(); const assertion = expect(old).rejects.toThrow()
    choose('qq'); await ticket()
    fail(new HostedSourceError('old failure', true)); await assertion
    expect(state().source).toMatchObject({ provider: 'qq', credential: 'none', accounts: { netease: { credential: 'ready' } } })
    expect(state().source?.error).toBeUndefined()
  })
})
