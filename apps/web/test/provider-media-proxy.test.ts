import { expect, it, vi } from 'vitest'
import { providerMediaProxy } from '../server/utils/provider-media-proxy'

const cdn = 'https://mcdn.bilivideo.cn:8082/audio.m4s?deadline=42'
const mediaRequest = (url = cdn, headers?: HeadersInit) => new Request(
  'http://localhost/api/provider-media?' + new URLSearchParams({ url }), { headers },
)

it('streams a partial audio response with Range metadata and no credentials', async () => {
  const upstream = vi.fn<typeof fetch>().mockResolvedValue(new Response('xyz', {
    status: 206,
    headers: { 'content-type': 'audio/mp4', 'content-range': 'bytes 3-5/8', 'set-cookie': 'secret=value' },
  }))
  const response = await providerMediaProxy(mediaRequest(cdn, { range: 'bytes=3-5', cookie: 'local=secret' }), upstream)
  const [url, init] = upstream.mock.calls[0]!
  expect(String(url)).toBe(cdn)
  expect(new Headers(init?.headers).get('range')).toBe('bytes=3-5')
  expect(new Headers(init?.headers).get('referer')).toBe('https://www.bilibili.com/')
  expect(new Headers(init?.headers).has('cookie')).toBe(false)
  expect(response.status).toBe(206)
  expect(response.headers.get('content-range')).toBe('bytes 3-5/8')
  expect(response.headers.has('set-cookie')).toBe(false)
  expect(await response.text()).toBe('xyz')
})

it('checks each redirect and blocks cross-provider or private targets', async () => {
  const upstream = vi.fn<typeof fetch>().mockResolvedValueOnce(Response.redirect('https://other.bilivideo.com/audio'))
    .mockResolvedValueOnce(Response.redirect('https://127.0.0.1/private'))
  expect((await providerMediaProxy(mediaRequest(), upstream)).status).toBe(502)
  expect(upstream).toHaveBeenCalledTimes(2)
  expect((await providerMediaProxy(mediaRequest('https://bilivideo.com.evil.example/audio'), upstream)).status).toBe(403)
  expect(upstream).toHaveBeenCalledTimes(2)
})

it('rejects HTML from an allowed CDN instead of serving it as same-origin content', async () => {
  const upstream = vi.fn<typeof fetch>().mockResolvedValue(new Response('<script>alert(1)</script>', { headers: { 'content-type': 'text/html' } }))
  expect((await providerMediaProxy(mediaRequest(), upstream)).status).toBe(502)
})
