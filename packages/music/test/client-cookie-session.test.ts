import { afterEach, expect, it, vi } from 'vitest'
vi.mock('../src/utils/constants', () => ({ TARGET_EXTENSION: true }))
import { getQQSession, qqToken } from '../src/utils/providers/qq-session'
import { getNeteaseCsrfToken } from '../src/utils/providers/netease-session'
import { CLIENT_COOKIE_PREFIX } from '../src/utils/client-cookies'
afterEach(() => { localStorage.clear(); vi.unstubAllGlobals() })

it('derives QQ account and token exclusively from the manual cookie, without mixing browser fields', async () => {
  const get = vi.fn(async () => ({ value: 'browser-account' }))
  vi.stubGlobal('chrome', { cookies: { get } })
  localStorage.setItem(CLIENT_COOKIE_PREFIX + 'qq', 'qqmusic_uin=456; qqmusic_key=manual-key')
  expect(await getQQSession()).toEqual({ uin: '456', key: 'manual-key', token: qqToken('manual-key'), cookieContext: 'qqmusic_uin=456; qqmusic_key=manual-key' })
  expect(get).not.toHaveBeenCalled()
  localStorage.setItem(CLIENT_COOKIE_PREFIX + 'qq', 'qqmusic_key=manual-key')
  expect((await getQQSession()).uin).toBe('0')
  expect(get).not.toHaveBeenCalled()
})
it('uses the manual Netease CSRF token, including an explicitly missing token, then restores browser lookup', async () => {
  const get = vi.fn(async () => ({ value: 'browser-csrf' }))
  vi.stubGlobal('chrome', { cookies: { get } })
  localStorage.setItem(CLIENT_COOKIE_PREFIX + 'netease', 'MUSIC_U=manual; __csrf=manual-csrf')
  expect(await getNeteaseCsrfToken()).toBe('manual-csrf')
  localStorage.setItem(CLIENT_COOKIE_PREFIX + 'netease', 'MUSIC_U=manual')
  expect(await getNeteaseCsrfToken()).toBe('')
  expect(get).not.toHaveBeenCalled()
  localStorage.removeItem(CLIENT_COOKIE_PREFIX + 'netease')
  expect(await getNeteaseCsrfToken()).toBe('browser-csrf')
})
