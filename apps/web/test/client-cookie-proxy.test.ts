import { expect, it, vi } from 'vitest'
import { clientCookieProxy } from '../server/utils/client-cookie-proxy'

const payload = { url: 'https://music.163.com/weapi/test', method: 'POST', cookie: 'MUSIC_U=manual', body: 'params=encoded', headers: { 'content-type': 'application/x-www-form-urlencoded' } }
const request = (data: unknown = payload, origin = 'http://localhost:3333') => new Request('http://localhost:3333/api/provider-request', { method: 'POST', headers: { 'content-type': 'application/json', origin, cookie: 'web_app_cookie=private' }, body: JSON.stringify(data) })

it('forwards only the explicitly supplied music cookie and controlled headers, without retaining upstream Set-Cookie', async () => {
  const upstream = vi.fn<typeof fetch>().mockResolvedValue(new Response('{"code":200}', { headers: { 'content-type': 'application/json', 'set-cookie': 'upstream=private', 'x-internal': 'private' } }))
  const response = await clientCookieProxy(request({ ...payload, headers: { ...payload.headers, host: 'evil.example', authorization: 'not-forwarded' } }), upstream)
  expect(response.status).toBe(200)
  expect(await response.json()).toEqual({ code: 200 })
  const [url, init] = upstream.mock.calls[0]!
  expect(String(url)).toBe(payload.url)
  const headers = new Headers(init?.headers)
  expect(headers.get('cookie')).toBe('MUSIC_U=manual')
  expect(headers.get('referer')).toBe('https://music.163.com/')
  expect(headers.has('authorization')).toBe(false)
  expect(headers.has('host')).toBe(false)
  expect(init).toMatchObject({ method: 'POST', redirect: 'error', body: 'params=encoded' })
  expect(response.headers.get('cache-control')).toBe('no-store')
  expect(response.headers.has('set-cookie')).toBe(false)
  expect(response.headers.has('x-internal')).toBe(false)
})
it.each(['http://127.0.0.1/private', 'https://music.163.com.evil.example/weapi/test', 'https://music.163.com:8443/weapi/test', 'https://music.163.com/song/media.mp3', 'https://user:pass@music.163.com/weapi/test', 'https://u.y.qq.com/other'])('rejects arbitrary proxy targets: %s', async url => {
  const upstream = vi.fn<typeof fetch>()
  expect((await clientCookieProxy(request({ ...payload, url }), upstream)).status).toBe(403)
  expect(upstream).not.toHaveBeenCalled()
})
it('rejects cross-origin requests, malformed cookies and unsupported methods before fetching', async () => {
  const upstream = vi.fn<typeof fetch>()
  expect((await clientCookieProxy(request(payload, 'https://other.example'), upstream)).status).toBe(403)
  expect((await clientCookieProxy(request({ ...payload, method: 'DELETE' }), upstream)).status).toBe(405)
  expect((await clientCookieProxy(request({ ...payload, cookie: 'bad\r\nheader=injection' }), upstream)).status).toBe(400)
  expect((await clientCookieProxy(request({ ...payload, cookie: '' }), upstream)).status).toBe(400)
  expect(upstream).not.toHaveBeenCalled()
})
it('bounds the request body and returns a controlled upstream error without echoing cookies or URLs', async () => {
  const upstream = vi.fn<typeof fetch>().mockRejectedValue(new Error('MUSIC_U=secret https://upstream.example/signed'))
  const failure = await clientCookieProxy(request(), upstream)
  expect(failure.status).toBe(502)
  expect(await failure.text()).toBe('{"message":"音源接口请求失败，请稍后重试"}')
  expect((await clientCookieProxy(request({ ...payload, body: 'x'.repeat(262_145) }), upstream)).status).toBe(413)
  expect(upstream).toHaveBeenCalledOnce()
})
