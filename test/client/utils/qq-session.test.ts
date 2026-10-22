import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('#shared/utils/constants', () => ({ TARGET_EXTENSION: true }))
const { getQQSession, qqToken } = await import('#shared/utils/providers/qq-session')
afterEach(() => vi.unstubAllGlobals())

describe('QQ 音乐会话', () => {
  it('读取 QQ 音乐域的账号与 key，去掉 uin 的 o / 前导零，实时计算 token', async () => {
    const cookies: Record<string, string> = { uin: 'o00123456', qqmusic_key: 'music-key', skey: 'old-key' }
    const get = vi.fn(async ({ name }: { name: string, url: string }) => cookies[name] ? { value: cookies[name] } : null)
    vi.stubGlobal('chrome', { cookies: { get } })
    expect(await getQQSession()).toEqual({ uin: '123456', key: 'music-key', token: qqToken('music-key') })
    expect(get).toHaveBeenCalledWith({ url: 'https://y.qq.com/', name: 'qqmusic_key' })
    expect(get.mock.calls.every(([details]) => details.url === 'https://y.qq.com/')).toBe(true)
    cookies.qqmusic_key = 'changed-key'
    expect((await getQQSession()).key).toBe('changed-key')
    expect(qqToken('')).toBe(5381)
    expect(qqToken('a')).toBe(177670)
  })
  it('QQ 音乐账号优先于 QQ 通用账号，并支持微信会话字段', async () => {
    const cookies: Record<string, string> = { qqmusic_uin: '777', uin: 'o00123', qqmusic_key: 'qq-key' }
    vi.stubGlobal('chrome', { cookies: { get: async ({ name }: { name: string }) => cookies[name] ? { value: cookies[name] } : null } })
    expect((await getQQSession()).uin).toBe('777')
    delete cookies.qqmusic_uin
    delete cookies.uin
    delete cookies.qqmusic_key
    cookies.wxuin = '888'
    cookies.qm_keyst = 'wx-key'
    expect(await getQQSession()).toEqual({ uin: '888', key: 'wx-key', token: qqToken('wx-key') })
  })
  it('没有扩展 API 或 Cookie 时匿名请求，不制造登录态', async () => {
    vi.stubGlobal('chrome', undefined)
    expect(await getQQSession()).toEqual({ uin: '0', key: '', token: 5381 })
    vi.stubGlobal('chrome', { cookies: { get: async () => null } })
    expect(await getQQSession()).toEqual({ uin: '0', key: '', token: 5381 })
  })
})
