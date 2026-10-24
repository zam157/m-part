import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { HostedSourceError } from '../server/providers/shared'
import { createNeteaseHostedProvider } from '../server/providers/netease'
import { createQQHostedProvider } from '../server/providers/qq'
import { createBiliHostedProvider } from '../server/providers/bilibili'
import { logRoomError } from '../server/utils/diagnostics'
import { createRoomControlHandler } from '../server/utils/room-http'
import type { HostedMedia } from '../server/utils/hosted-media'

let output: ReturnType<typeof vi.spyOn>
const entry = () => JSON.parse(String(output.mock.calls.at(-1)?.[1]))
beforeEach(() => { output = vi.spyOn(console, 'error').mockImplementation(() => {}) })
afterEach(() => vi.restoreAllMocks())

describe('room server error diagnostics', () => {
  it('retains upstream HTTP status and a fixed endpoint without logging request credentials', async () => {
    const provider = createNeteaseHostedProvider(vi.fn<typeof fetch>().mockResolvedValue(new Response(null, { status: 403 })))
    try { await provider.resolve('MUSIC_U=private-session;', '1519343', new AbortController().signal) }
    catch (error) { logRoomError('http.control.ticket', error) }
    expect(entry()).toMatchObject({ operation: 'http.control.ticket', provider: 'netease', phase: 'api', endpoint: '/weapi/song/enhance/player/url', httpStatus: 403 })
    expect(JSON.stringify(output.mock.calls)).not.toContain('private-session')
  })

  it.each([
    ['netease', () => createNeteaseHostedProvider(vi.fn<typeof fetch>().mockResolvedValue(Response.json({ code: 301, message: 'private-upstream-message' }))).validate('MUSIC_U=private;', new AbortController().signal), [301]],
    ['qq', () => createQQHostedProvider(vi.fn<typeof fetch>().mockResolvedValue(Response.json({ code: 0, req_0: { code: 2000 }, message: 'private-upstream-message' }))).resolve('', '0039MnYb0qxYhV', new AbortController().signal), [0, 2000]],
    ['bili', () => createBiliHostedProvider(vi.fn<typeof fetch>().mockResolvedValue(Response.json({ code: -412, message: 'private-upstream-message' }))).resolve('', 'BV1GJ411x7h7', new AbortController().signal), [-412]],
  ] as const)('reports %s business errors without upstream response text', async (provider, run, upstreamCodes) => {
    try { await run() } catch (error) { logRoomError('media.source', error) }
    expect(entry()).toMatchObject({ provider, httpStatus: 200, upstreamCodes })
    expect(JSON.stringify(output.mock.calls)).not.toContain('private-upstream-message')
  })

  it('reports a nested network cause while discarding raw messages, URLs and stacks', () => {
    const cause = Object.assign(new Error('Cookie: MUSIC_U=private; https://private.example/file?ticket=secret'), { code: 'ECONNRESET' })
    logRoomError('media.response', new TypeError('fetch failed private-token', { cause }))
    expect(entry()).toMatchObject({ causes: [{ name: 'TypeError' }, { name: 'Error', code: 'ECONNRESET' }] })
    for (const secret of ['private-token', 'private.example', 'MUSIC_U', 'secret', 'stack']) expect(JSON.stringify(output.mock.calls)).not.toContain(secret)
  })

  it('redacts sensitive fields in controlled messages and never logs arbitrary context properties', () => {
    const error = new HostedSourceError(`CDN https://private.example/audio?ticket=${'a'.repeat(64)}\nCookie: MUSIC_U=private`)
    logRoomError('media.response', error, { endpoint: '/audio?ticket=secret', status: 502, ...{ cookie: 'private-cookie', token: 'private-token' } })
    expect(entry()).toMatchObject({ status: 502 })
    for (const secret of ['private', 'a'.repeat(64), 'secret', 'MUSIC_U']) expect(JSON.stringify(output.mock.calls)).not.toContain(secret)
    expect(entry().endpoint).toBeUndefined()
  })

  it('logs once when the same failure passes through multiple boundaries', () => {
    const error = new HostedSourceError('音源不可用')
    logRoomError('media.source', error)
    logRoomError('http.control.ticket', error)
    expect(output).toHaveBeenCalledOnce()
  })

  it('preserves the failing API status when a CDN refresh triggers another upstream request', () => {
    const error = new HostedSourceError('上游限流', false, { provider: 'netease', phase: 'api', endpoint: '/weapi/song/enhance/player/url', httpStatus: 429 })
    logRoomError('media.response', error, { phase: 'cdn', httpStatus: 403 })
    expect(entry()).toMatchObject({ provider: 'netease', phase: 'api', httpStatus: 429, endpoint: '/weapi/song/enhance/player/url' })
  })

  it('logs control failures without copying body, authorization or server URL to the console', async () => {
    const error = new HostedSourceError('会话失效', true, { provider: 'netease', phase: 'api', httpStatus: 403 })
    const media = { control: vi.fn().mockRejectedValue(error) } as unknown as HostedMedia
    const origin = `chrome-extension://${'b'.repeat(32)}`
    const handler = createRoomControlHandler(media, { allowedOrigins: () => origin })
    const request = new Request('https://rooms.example/room-control?token=private-query', { method: 'POST', headers: { origin, authorization: `Bearer ${'c'.repeat(64)}` }, body: JSON.stringify({ action: 'credential', roomId: 'room', expectedRevision: 0, provider: 'netease', cookie: 'MUSIC_U=private-cookie' }) })
    expect((await handler(request)).status).toBe(400)
    expect(entry()).toMatchObject({ operation: 'http.control.credential', status: 400, provider: 'netease', httpStatus: 403 })
    for (const secret of ['private-query', 'private-cookie', 'c'.repeat(64), 'rooms.example']) expect(JSON.stringify(output.mock.calls)).not.toContain(secret)
  })

  it('does not log an HTTP request cancelled by its caller', async () => {
    const controller = new AbortController()
    const media = { control: vi.fn().mockImplementation(() => { controller.abort(); throw new DOMException('Cancelled', 'AbortError') }) } as unknown as HostedMedia
    const origin = `chrome-extension://${'b'.repeat(32)}`
    const request = new Request('https://rooms.example/room-control', { method: 'POST', signal: controller.signal, headers: { origin, authorization: `Bearer ${'c'.repeat(64)}` }, body: JSON.stringify({ action: 'retry-source', roomId: 'room', expectedRevision: 0 }) })
    await createRoomControlHandler(media, { allowedOrigins: () => origin })(request)
    expect(output).not.toHaveBeenCalled()
  })
})
