import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('../src/utils/constants', () => ({ TARGET_EXTENSION: true }))
const { getNeteaseCsrfToken } = await import('../src/utils/providers/netease-session')
afterEach(() => vi.unstubAllGlobals())

describe('网易云会话 CSRF', () => {
  it('仅读取当前浏览器的网易云 __csrf，不读取登录 Cookie', async () => {
    const get = vi.fn().mockResolvedValue({ value: 'csrf-token' })
    vi.stubGlobal('chrome', { cookies: { get } })
    expect(await getNeteaseCsrfToken()).toBe('csrf-token')
    expect(get).toHaveBeenCalledExactlyOnceWith({ url: 'https://music.163.com/', name: '__csrf' })
  })
  it('没有会话 Cookie 或扩展 API 时使用空 token', async () => {
    vi.stubGlobal('chrome', { cookies: { get: async () => null } })
    expect(await getNeteaseCsrfToken()).toBe('')
    vi.stubGlobal('chrome', undefined)
    expect(await getNeteaseCsrfToken()).toBe('')
  })
})
