import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { HostedMedia } from '../server/utils/hosted-media'
import { createRoomControlHandler } from '../server/utils/room-http'

const { media } = vi.hoisted(() => ({ media: { audio: vi.fn(), control: vi.fn() } }))
vi.mock('../server/utils/runtime', () => ({ rooms: {}, hostedMedia: media }))
vi.mock('nitro', () => ({ defineWebSocketHandler: (handler: unknown) => handler, defineHandler: (handler: unknown) => handler }))
const ws = (await import('../server/routes/ws')).default as unknown as { upgrade: (request: Request) => void }
const audio = (await import('../server/routes/room-audio')).default as unknown as (event: { req: Request, url: URL }) => Promise<Response>
const extension = `chrome-extension://${'a'.repeat(32)}`
const allowed = () => process.env.LISTEN_ALLOWED_ORIGINS
const token = 'b'.repeat(64)
function request(path: string, origin?: string, method = 'GET', authenticated = true) {
  const headers = new Headers()
  if (origin !== undefined) headers.set('origin', origin)
  if (authenticated) headers.set('authorization', `Bearer ${token}`)
  return new Request(`https://rooms.example${path}`, { method, headers, ...(method === 'POST' ? { body: JSON.stringify({ action: 'retry-source', roomId: 'room', expectedRevision: 0 }) } : {}) })
}
function audioRequest(origin?: string, ticket = token) {
  const req = request(`/room-audio?ticket=${ticket}`, origin)
  return audio({ req, url: new URL(req.url) })
}
beforeEach(() => {
  vi.stubEnv('LISTEN_ALLOWED_ORIGINS', undefined)
  vi.spyOn(console, 'error').mockImplementation(() => {})
  media.control.mockReset().mockResolvedValue({ ok: true })
  media.audio.mockReset().mockImplementation(async () => new Response('audio'))
})
afterEach(() => { vi.unstubAllEnvs(); vi.restoreAllMocks() })

describe('optional origin validation at room routes', () => {
  it.each([undefined, 'https://app.example', extension])('allows public WebSocket upgrades by default for %s', (origin) => {
    expect(() => ws.upgrade(request('/ws', origin))).not.toThrow()
  })

  it('checks WebSocket upgrades only against the explicit list and rejects missing origins in that mode', () => {
    vi.stubEnv('LISTEN_ALLOWED_ORIGINS', extension)
    expect(() => ws.upgrade(request('/ws', extension))).not.toThrow()
    for (const origin of [undefined, 'https://app.example']) {
      let rejection: unknown
      try { ws.upgrade(request('/ws', origin)) } catch (error) { rejection = error }
      expect(rejection).toBeInstanceOf(Response)
      expect((rejection as Response).status).toBe(403)
    }
    vi.stubEnv('LISTEN_ALLOWED_ORIGINS', '')
    expect(() => ws.upgrade(request('/ws', extension))).toThrow()
  })

  it.each([undefined, 'https://app.example', extension])('allows authenticated HTTP controls by default for %s', async (origin) => {
    const handler = createRoomControlHandler(media as unknown as HostedMedia, { allowedOrigins: allowed })
    const response = await handler(request('/room-control', origin, 'POST'))
    expect(response.status).toBe(200)
    expect(response.headers.get('access-control-allow-origin')).toBe(origin ?? null)
    expect(media.control).toHaveBeenCalledExactlyOnceWith(token, { action: 'retry-source', roomId: 'room', expectedRevision: 0 }, expect.any(AbortSignal))
  })

  it('keeps token authentication active when origin validation is off', async () => {
    const handler = createRoomControlHandler(media as unknown as HostedMedia)
    expect((await handler(request('/room-control', undefined, 'POST', false))).status).toBe(401)
    expect(media.control).not.toHaveBeenCalled()
  })

  it('uses the configured allowlist for HTTP requests and CORS preflights', async () => {
    const handler = createRoomControlHandler(media as unknown as HostedMedia, { allowedOrigins: allowed })
    expect((await handler(request('/room-control', 'https://app.example', 'OPTIONS'))).status).toBe(204)
    vi.stubEnv('LISTEN_ALLOWED_ORIGINS', extension)
    const response = await handler(request('/room-control', extension, 'OPTIONS'))
    expect(response.status).toBe(204)
    expect(response.headers.get('access-control-allow-origin')).toBe(extension)
    expect((await handler(request('/room-control', 'https://app.example', 'OPTIONS'))).status).toBe(403)
    expect((await handler(request('/room-control', undefined, 'POST'))).status).toBe(403)
    expect((await handler(request('/room-control', extension, 'POST'))).status).toBe(200)
    vi.stubEnv('LISTEN_ALLOWED_ORIGINS', '')
    expect((await handler(request('/room-control', extension, 'OPTIONS'))).status).toBe(403)
  })

  it('applies the optional list to audio origins while retaining ticket-based native audio without Origin', async () => {
    const response = await audioRequest('https://app.example')
    expect(response.status).toBe(200)
    expect(response.headers.get('access-control-allow-origin')).toBe('https://app.example')
    vi.stubEnv('LISTEN_ALLOWED_ORIGINS', extension)
    expect((await audioRequest(extension)).status).toBe(200)
    expect((await audioRequest('https://app.example')).status).toBe(403)
    expect((await audioRequest()).status).toBe(200)
    expect(media.audio).toHaveBeenCalledTimes(3)
    vi.stubEnv('LISTEN_ALLOWED_ORIGINS', undefined)
    expect((await audioRequest(undefined, 'invalid')).status).toBe(401)
    expect(media.audio).toHaveBeenCalledTimes(3)
  })
})
