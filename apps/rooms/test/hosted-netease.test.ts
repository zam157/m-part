import { describe, expect, it, vi } from 'vitest'
import { createNeteaseHostedProvider, parseNeteaseCookie, validateNeteaseMediaUrl } from '../server/providers/netease'

const cookie = 'MUSIC_U=abcdefghijklmnop123456; __csrf=0123456789abcdef;'
const response = (value: unknown, status = 200) => Response.json(value, { status })
const signal = () => new AbortController().signal

describe('controlled NetEase server session adapter', () => {
  it('uses only the fixed API host and masks the account identity', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(response({ code: 200, account: { id: 12345678 }, profile: { userId: 12345678, nickname: 'Do not broadcast this' } }))
    const label = await createNeteaseHostedProvider(fetcher).validate(cookie, signal())
    expect(label).toBe('网易云账号 · 尾号 5678')
    expect(fetcher.mock.calls[0]?.[0]).toBe('https://music.163.com/weapi/w/nuser/account/get')
    expect(fetcher.mock.calls[0]?.[1]).toMatchObject({ redirect: 'manual', credentials: 'omit' })
    expect(new Headers(fetcher.mock.calls[0]?.[1]?.headers).get('cookie')).toBe(cookie)
    expect(String(fetcher.mock.calls[0]?.[1]?.body)).not.toContain('MUSIC_U')
  })
  it.each([
    { code: 301 }, { code: 200, profile: null }, { code: 200, account: {}, profile: { userId: 'unsafe' } },
  ])('rejects invalid sessions without echoing upstream messages: %#', async (data) => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(response({ ...data, message: `${cookie} https://private.example` }))
    await expect(createNeteaseHostedProvider(fetcher).validate(cookie, signal())).rejects.toThrow(/会话不可用|凭据已失效/)
  })
  it('rejects preview audio, preserves full-track rights and checks CDN identity', async () => {
    const fetcher = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(response({ code: 200, data: [{ id: 123, code: 200, url: 'http://m1.music.126.net/a.mp3', freeTrialInfo: { start: 10 } }] }))
      .mockResolvedValueOnce(response({ code: 200, data: [{ id: 123, code: 200, url: 'http://m1.music.126.net/a.mp3', md5: 'a'.repeat(32), size: 12345 }] }))
    const provider = createNeteaseHostedProvider(fetcher)
    await expect(provider.resolve(cookie, '123', signal())).rejects.toThrow('试听')
    await expect(provider.resolve(cookie, '123', signal())).resolves.toEqual({ url: 'https://m1.music.126.net/a.mp3', hash: 'a'.repeat(32), size: 12345 })
  })
  it.each(['https://music.126.net.evil.example/a', 'http://127.0.0.1/a', 'https://user:pass@m1.music.126.net/a', 'https://m1.music.126.net:8443/a', 'file:///etc/passwd'])('rejects untrusted media location %s', (url) => {
    expect(() => validateNeteaseMediaUrl(url)).toThrow()
  })
  it.each(['MUSIC_U=short', 'MUSIC_U=abcdefghijklmnop\r\nCookie: leak', 'MUSIC_U=abcdefghijklmnop; __csrf=bad'])('rejects malformed cookie values', (value) => {
    expect(() => parseNeteaseCookie(value)).toThrow()
  })
  it('bounds upstream JSON before parsing and rejects API redirects', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValueOnce(new Response(' '.repeat(129 * 1024))).mockResolvedValueOnce(new Response(null, { status: 302, headers: { location: 'https://evil.example' } }))
    const provider = createNeteaseHostedProvider(fetcher)
    await expect(provider.validate(cookie, signal())).rejects.toThrow('过大')
    await expect(provider.validate(cookie, signal())).rejects.toThrow('托管请求失败')
  })
})
