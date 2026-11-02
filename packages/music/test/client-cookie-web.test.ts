import { afterEach, expect, it, vi } from 'vitest'
vi.mock('../src/utils/constants', () => ({ TARGET_EXTENSION: false, USE_PROXY: true, USE_GM_FETCH: false }))
import { tRequest } from '../src/utils/fetch'
import { setClientCookie } from '../src/utils/client-cookies'
afterEach(() => { localStorage.clear(); vi.unstubAllGlobals() })
it('forwards the selected platform cookie and encoded body through the bounded Web endpoint', async () => {
  await setClientCookie('netease', 'MUSIC_U=manual; __csrf=test')
  const fetcher = vi.fn<typeof fetch>().mockImplementation(async () => Response.json({ code: 200 }))
  vi.stubGlobal('fetch', fetcher)
  await tRequest('https://music.163.com/weapi/test', { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ params: 'a+b=' }) })
  const [url, init] = fetcher.mock.calls[0]!
  expect(url).toBe('/api/provider-request')
  expect(init?.credentials).toBe('omit')
  expect(JSON.parse(init?.body as string)).toMatchObject({ url: 'https://music.163.com/weapi/test', cookie: 'MUSIC_U=manual; __csrf=test', method: 'POST', body: 'params=a%2Bb%3D' })
})
it('resolves a legacy relative Bili proxy URL with search parameters before forwarding', async () => {
  await setClientCookie('bili', 'SESSDATA=manual')
  const fetcher = vi.fn<typeof fetch>().mockImplementation(async () => Response.json({ code: 0 }))
  vi.stubGlobal('fetch', fetcher)
  await tRequest('/api/proxy/bili/x/web-interface/nav', { searchParams: { test: 1 } })
  expect(JSON.parse(fetcher.mock.calls[0]![1]?.body as string).url).toBe('https://api.bilibili.com/x/web-interface/nav?test=1')
})
