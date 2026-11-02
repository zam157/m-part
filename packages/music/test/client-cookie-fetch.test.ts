import { afterEach, beforeEach, expect, it, vi } from 'vitest'
vi.mock('../src/utils/constants', () => ({ TARGET_EXTENSION: true, USE_PROXY: false, USE_GM_FETCH: false }))
import { tRequest } from '../src/utils/fetch'
import { setClientCookie, setClientCookieMode, getStoredClientCookie, CLIENT_COOKIE_PREFIX } from '../src/utils/client-cookies'
const fetcher = vi.fn<typeof fetch>()
const update = vi.fn(async (_options: unknown) => {})
beforeEach(() => {
  localStorage.clear(); update.mockReset().mockResolvedValue(); fetcher.mockReset().mockImplementation(async () => Response.json({ code: 0 }))
  vi.stubGlobal('fetch', fetcher)
  vi.stubGlobal('chrome', { runtime: { id: 'extension' }, declarativeNetRequest: { updateSessionRules: update } })
})
afterEach(async () => { for (const source of ['bili', 'netease', 'qq'] as const) await setClientCookie(source, ''); localStorage.clear(); vi.unstubAllGlobals() })

it('uses omit plus a Cookie replacement rule for a manually selected API account, then restores include', async () => {
  await setClientCookie('bili', 'SESSDATA=manual')
  await setClientCookieMode('bili', 'manual')
  await tRequest('https://api.bilibili.com/x/web-interface/nav')
  expect(fetcher.mock.calls[0]![1]?.credentials).toBe('omit')
  expect(new Headers(fetcher.mock.calls[0]![1]?.headers).has('cookie')).toBe(false)
  expect(update).toHaveBeenCalledWith(expect.objectContaining({ addRules: [expect.objectContaining({ action: { type: 'modifyHeaders', requestHeaders: [{ header: 'cookie', operation: 'set', value: 'SESSDATA=manual' }] } })] }))
  await setClientCookieMode('bili', 'website')
  await tRequest('https://api.bilibili.com/x/web-interface/nav')
  expect(fetcher.mock.calls[1]![1]?.credentials).toBe('include')
  expect(getStoredClientCookie('bili')).toBe('SESSDATA=manual')
})
it('fails before fetching if a saved override cannot be applied', async () => {
  localStorage.setItem(CLIENT_COOKIE_PREFIX + 'netease', 'MUSIC_U=fail-closed')
  update.mockRejectedValueOnce(new Error('blocked'))
  await expect(tRequest('https://music.163.com/weapi/test')).rejects.toThrow('无法应用音源 Cookie')
  expect(fetcher).not.toHaveBeenCalled()
})
it('does not attach manual cookies to room servers, CDN URLs, or other platforms', async () => {
  await setClientCookie('netease', 'MUSIC_U=manual')
  update.mockClear()
  await tRequest('https://m1.music.126.net/audio.mp3', { returnJson: false })
  await tRequest('http://127.0.0.1:3410/room-control', { method: 'POST' })
  await tRequest('https://api.bilibili.com/x/web-interface/nav')
  for (const [, init] of fetcher.mock.calls) expect(new Headers(init?.headers).has('cookie')).toBe(false)
  expect(fetcher.mock.calls.every(([, init]) => init?.credentials !== 'omit')).toBe(true)
})
it('discards a response if the chosen account changed while its request was running', async () => {
  await setClientCookie('qq', 'uin=111')
  await setClientCookieMode('qq', 'manual')
  let release!: (response: Response) => void
  fetcher.mockImplementation(() => new Promise(resolve => { release = resolve }))
  const pending = tRequest('https://u.y.qq.com/cgi-bin/musicu.fcg')
  await vi.waitFor(() => expect(fetcher).toHaveBeenCalledOnce())
  await setClientCookie('qq', 'uin=222')
  release(Response.json({ data: 'old account' }))
  await expect(pending).rejects.toThrow('Cookie 已更新')
})
it('rejects authentication fields derived before the Cookie selection changed', async () => {
  await setClientCookie('netease', 'MUSIC_U=new; __csrf=new-token')
  await setClientCookieMode('netease', 'manual')
  await expect(tRequest('https://music.163.com/weapi/test', { cookieContext: 'MUSIC_U=old; __csrf=old-token' })).rejects.toThrow('Cookie 已更新')
  expect(fetcher).not.toHaveBeenCalled()
})
it('refuses to use website credentials when manual mode is selected without a saved Cookie', async () => {
  await setClientCookieMode('bili', 'manual')
  await expect(tRequest('https://api.bilibili.com/x/web-interface/nav')).rejects.toThrow('尚未保存手动 Cookie')
  expect(fetcher).not.toHaveBeenCalled()
})
it('discards an in-flight manual response after switching to website mode', async () => {
  await setClientCookie('bili', 'SESSDATA=saved')
  await setClientCookieMode('bili', 'manual')
  let release!: (response: Response) => void
  fetcher.mockImplementation(() => new Promise(resolve => { release = resolve }))
  const pending = tRequest('https://api.bilibili.com/x/web-interface/nav')
  await vi.waitFor(() => expect(fetcher).toHaveBeenCalledOnce())
  await setClientCookieMode('bili', 'website')
  release(Response.json({ data: 'old account' }))
  await expect(pending).rejects.toThrow('Cookie 已更新')
})
