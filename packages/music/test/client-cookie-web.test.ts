import { afterEach, expect, it, vi } from 'vitest'
vi.mock('../src/utils/constants', () => ({ TARGET_EXTENSION: false, USE_GM_FETCH: false }))
import { tRequest } from '../src/utils/fetch'
import { setClientCookie, setClientCookieMode } from '../src/utils/client-cookies'
afterEach(() => { localStorage.clear(); vi.unstubAllGlobals() })
it('forwards the selected platform cookie and encoded body through the bounded Web endpoint', async () => {
  await setClientCookie('netease', 'MUSIC_U=manual; __csrf=test')
  await setClientCookieMode('netease', 'manual')
  const fetcher = vi.fn<typeof fetch>().mockImplementation(async () => Response.json({ code: 200 }))
  vi.stubGlobal('fetch', fetcher)
  await tRequest('https://music.163.com/weapi/test', { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ params: 'a+b=' }) })
  const [url, init] = fetcher.mock.calls[0]!
  expect(url).toBe('/api/provider-request')
  expect(init?.credentials).toBe('omit')
  expect(JSON.parse(init?.body as string)).toMatchObject({ url: 'https://music.163.com/weapi/test', cookie: 'MUSIC_U=manual; __csrf=test', method: 'POST', body: 'params=a%2Bb%3D' })
})
it('resolves the official Bili API URL and search parameters before forwarding', async () => {
  await setClientCookie('bili', 'SESSDATA=manual')
  await setClientCookieMode('bili', 'manual')
  const fetcher = vi.fn<typeof fetch>().mockImplementation(async () => Response.json({ code: 0 }))
  vi.stubGlobal('fetch', fetcher)
  await tRequest('https://api.bilibili.com/x/web-interface/nav', { searchParams: { test: 1 } })
  expect(JSON.parse(fetcher.mock.calls[0]![1]?.body as string).url).toBe('https://api.bilibili.com/x/web-interface/nav?test=1')
})
it('does not submit retained manual Cookies to the Web forwarder in website mode', async () => {
  await setClientCookie('netease', 'MUSIC_U=retained')
  await setClientCookieMode('netease', 'website')
  const fetcher = vi.fn<typeof fetch>().mockImplementation(async () => Response.json({ code: 200 }))
  vi.stubGlobal('fetch', fetcher)
  await tRequest('https://music.163.com/weapi/test')
  expect(fetcher.mock.calls[0]![0]).toBe('/api/provider-request')
  expect(JSON.parse(fetcher.mock.calls[0]![1]?.body as string)).not.toHaveProperty('cookie')
  expect(fetcher.mock.calls[0]![1]?.credentials).toBe('omit')
})

it('leaves room requests on their direct transport and routes official audio through the media proxy', async () => {
  const fetcher = vi.fn<typeof fetch>().mockImplementation(async () => new Response('audio'))
  vi.stubGlobal('fetch', fetcher)
  const audio = 'https://m10.music.126.net/audio.mp3'
  await tRequest(audio, { headers: { cookie: 'never=forwarded' }, returnJson: false })
  expect(fetcher.mock.calls[0]![0]).toBe('/api/provider-media?' + new URLSearchParams({ url: audio }))
  expect(new Headers(fetcher.mock.calls[0]![1]?.headers).has('cookie')).toBe(false)
  const control = 'https://api.bilibili.com/x/room-control'
  await tRequest(control, { method: 'POST', direct: true, credentials: 'omit', headers: { authorization: 'Bearer room' }, returnJson: false })
  expect(fetcher.mock.calls[1]![0]).toBe(control)
  expect(new Headers(fetcher.mock.calls[1]![1]?.headers).get('authorization')).toBe('Bearer room')
})
