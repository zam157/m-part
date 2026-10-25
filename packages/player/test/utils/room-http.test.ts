import { afterEach, describe, expect, it, vi } from 'vitest'
import { sendRoomControl } from '~/utils/room-http'

vi.mock('@m-part/music/constants', () => ({ TARGET_EXTENSION: true, USE_PROXY: false, USE_GM_FETCH: false }))
afterEach(() => vi.unstubAllGlobals())

describe('room HTTP control transport', () => {
  it('uses bearer authentication with credentials omitted, never forwarding the browser session', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(Response.json({ ok: true }))
    vi.stubGlobal('fetch', fetcher)
    await sendRoomControl('https://rooms.example', 'member-token', { action: 'revoke', provider: 'netease', roomId: 'room', expectedRevision: 1 })
    const options = fetcher.mock.calls[0]?.[1]
    expect(options).toMatchObject({ credentials: 'omit', method: 'POST' })
    expect(new Headers(options?.headers).get('authorization')).toBe('Bearer member-token')
    expect(new Headers(options?.headers).has('cookie')).toBe(false)
    expect(options).not.toHaveProperty('acceptHttpErrors')
  })
  it('retains controlled API error messages even for non-2xx status codes', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json({ error: '仅房主可管理房间音源' }, { status: 403 })))
    await expect(sendRoomControl('https://rooms.example', 'token', { action: 'revoke', provider: 'netease', roomId: 'room', expectedRevision: 1 })).rejects.toThrow('仅房主')
  })
  it.each(['http://192.168.1.10:3410', 'http://rooms.example', 'https://rooms.example'])('submits credentials over %s without checking TLS', async (server) => {
    const fetcher = vi.fn().mockResolvedValue(Response.json({ ok: true }))
    vi.stubGlobal('fetch', fetcher)
    const control = { action: 'credential' as const, cookie: 'private-test-session', roomId: 'room', expectedRevision: 1 }
    await expect(sendRoomControl(server, 'token', control)).resolves.toEqual({ ok: true })
    expect(fetcher).toHaveBeenCalledExactlyOnceWith(`${server}/room-control`, expect.objectContaining({ method: 'POST', credentials: 'omit', body: JSON.stringify(control) }))
  })
})
