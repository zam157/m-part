import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
vi.mock('../src/utils/constants', () => ({ TARGET_EXTENSION: true }))
import { CLIENT_COOKIE_PREFIX, clientCookieRule, clientCookieValue, getClientCookie, normalizeClientCookie, setClientCookie, syncClientCookie } from '../src/utils/client-cookies'
import { providerRequest } from '../src/utils/provider-request'

const update = vi.fn(async (_options: unknown) => {})
beforeEach(() => {
  localStorage.clear()
  update.mockReset().mockResolvedValue()
  vi.stubGlobal('chrome', { runtime: { id: 'extension-id' }, declarativeNetRequest: { updateSessionRules: update } })
})
afterEach(async () => { for (const source of ['bili', 'netease', 'qq'] as const) await setClientCookie(source, ''); localStorage.clear(); vi.unstubAllGlobals() })

describe('client Cookie settings', () => {
  it('normalizes a Cookie header without corrupting encoded values or equals signs', () => {
    expect(normalizeClientCookie(' Cookie: MUSIC_U=a=b==; __csrf=token; MUSIC_U=ignored; ')).toBe('MUSIC_U=a=b==; __csrf=token')
    expect(clientCookieValue('MUSIC_U=a=b==; __csrf=token', 'MUSIC_U')).toBe('a=b==')
    expect(clientCookieValue('MUSIC_U=a', '__csrf')).toBe('')
    expect(normalizeClientCookie('  ')).toBe('')
  })
  it('preserves commas in Cookie values through parsing, storage and extension rules', async () => {
    const cookie = 'foo=1,2,3; bar=abc'
    expect(normalizeClientCookie(cookie)).toBe(cookie)
    expect(clientCookieValue(cookie, 'foo')).toBe('1,2,3')
    await setClientCookie('bili', cookie)
    expect(getClientCookie('bili')).toBe(cookie)
    expect(update).toHaveBeenCalledWith(expect.objectContaining({ addRules: [expect.objectContaining({ action: { type: 'modifyHeaders', requestHeaders: [{ header: 'cookie', operation: 'set', value: cookie }] } })] }))
  })
  it.each(['bad', '=value', 'key=one\r\nother=value', 'key=hello world', 'key=中文', `key=${'x'.repeat(16_384)}`])('rejects malformed headers without persisting them', async value => {
    await expect(setClientCookie('bili', value)).rejects.toThrow('Cookie 格式无效')
    expect(getClientCookie('bili')).toBe('')
  })
  it('persists separate platform settings and removes only the chosen override', async () => {
    await setClientCookie('bili', 'SESSDATA=bili')
    await setClientCookie('qq', 'uin=123; qqmusic_key=qq')
    expect(localStorage.getItem(CLIENT_COOKIE_PREFIX + 'bili')).toBe('SESSDATA=bili')
    await setClientCookie('bili', '')
    expect(getClientCookie('bili')).toBe('')
    expect(getClientCookie('qq')).toBe('uin=123; qqmusic_key=qq')
    expect(update).toHaveBeenCalledWith({ removeRuleIds: [11001], addRules: [] })
  })
  it('limits replacement to this extension and the selected official API, not website tabs or CDN media', () => {
    const rule = clientCookieRule('bili', 'SESSDATA=test', 'own-extension')
    expect(rule.condition.initiatorDomains).toEqual(['own-extension'])
    expect(rule.condition.resourceTypes).toEqual(['xmlhttprequest'])
    expect(new RegExp(rule.condition.regexFilter).test('https://api.bilibili.com/x/web-interface/nav')).toBe(true)
    expect(new RegExp(rule.condition.regexFilter).test('https://api.bilibili.com.evil.example/x/test')).toBe(false)
    expect(rule.action.requestHeaders).toEqual([{ header: 'cookie', operation: 'set', value: 'SESSDATA=test' }])
  })
  it('recreates a session rule on first use and awaits pending updates before subsequent requests', async () => {
    let release!: () => void
    update.mockImplementationOnce(() => new Promise<void>(resolve => { release = resolve }))
    const first = syncClientCookie('netease', '__csrf=first')
    const second = syncClientCookie('netease', '__csrf=second')
    await Promise.resolve()
    expect(update).toHaveBeenCalledTimes(1)
    release(); await first; await second
    expect(update).toHaveBeenCalledTimes(2)
    expect(update.mock.calls[1]![0]).toMatchObject({ addRules: [{ action: { requestHeaders: [{ value: '__csrf=second' }] } }] })
  })
  it('rolls back failed rules and never quietly changes to browser credentials', async () => {
    await setClientCookie('bili', 'SESSDATA=old')
    update.mockRejectedValueOnce(new Error('upstream must not be echoed'))
    await expect(setClientCookie('bili', 'SESSDATA=new')).rejects.toThrow('无法应用音源 Cookie')
    expect(getClientCookie('bili')).toBe('SESSDATA=old')
  })
  it('reapplies rules even for an unchanged selection because another extension tab can change them', async () => {
    await syncClientCookie('bili', '')
    update.mockClear()
    await syncClientCookie('bili', '')
    expect(update).toHaveBeenCalledWith({ removeRuleIds: [11001], addRules: [] })
  })
  it('does not save when persistence fails', async () => {
    const set = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('quota') })
    await expect(setClientCookie('qq', 'uin=123')).rejects.toThrow('无法保存音源 Cookie')
    set.mockRestore()
    expect(getClientCookie('qq')).toBe('')
  })
  it.each(['http://api.bilibili.com/x/test', 'https://api.bilibili.com.evil.example/x/test', 'https://music.163.com.evil.example/weapi/test', 'https://c.y.qq.com.evil.example/soso/test', 'https://m1.music.126.net/song.mp3', 'https://api.bilibili.com/room-control', 'https://127.0.0.1/room-control', 'https://user:pass@music.163.com/weapi/test', 'https://music.163.com:8443/weapi/test'])('does not classify a non-API credential destination: %s', url => {
    expect(providerRequest(url)).toBeUndefined()
  })
})
