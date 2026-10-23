import { describe, expect, it, vi } from 'vitest'
import { createQQHostedProvider, parseQQCookie, validateQQMediaUrl } from '../server/providers/qq'
import { createBiliHostedProvider, parseBiliCookie, validateBiliMediaUrl } from '../server/providers/bilibili'

const signal = () => new AbortController().signal
const qqCookie = 'qqmusic_uin=12345678; qqmusic_key=abcdefghijklmnop; eas_sid=private-sid; unrelated=secret;'
const biliCookie = 'SESSDATA=abcdefghijklmnop%2C; bili_jct=abcdef; DedeUserID=12345678; unrelated=secret;'
const mid = '003rJSwm3TechU'
const media = '001mediaMid123'
const filename = `M800${mid}${media}.mp3`
const rpc = (data: unknown) => Response.json({ code: 0, req_0: { code: 0, data } })
const bili = (data: unknown) => Response.json({ code: 0, data })
const nav = { isLogin: true, mid: 12345678, wbi_img: { img_url: `https://i0.hdslb.com/bfs/wbi/${'a'.repeat(32)}.png`, sub_url: `https://i0.hdslb.com/bfs/wbi/${'b'.repeat(32)}.png` } }
const view = { bvid: 'BV1234567890', cid: 123, duration: 120 }
const audio = { id: 30280, codecs: 'mp4a.40.2', bandwidth: 192000, baseUrl: 'https://upos-sz-mirror.bilivideo.com/audio.m4s' }
const dash = { timelength: 120000, dash: { audio: [audio], video: [{ baseUrl: 'https://video.example/do-not-fetch' }] } }

function biliResolve(data: unknown = dash, detail: unknown = view) {
  const fetcher = vi.fn<typeof fetch>().mockResolvedValueOnce(bili(detail)).mockResolvedValueOnce(bili(nav)).mockResolvedValueOnce(bili(data))
  return { fetcher, result: createBiliHostedProvider(fetcher).resolve(parseBiliCookie(biliCookie), view.bvid, signal()) }
}

describe('QQ hosted adapter', () => {
  it('strips unrelated cookies, validates the login-only endpoint and masks identity', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(rpc({ info: { nick: 'Private nickname', uin: 12345678 } }))
    const provider = createQQHostedProvider(fetcher)
    await expect(provider.validate(parseQQCookie(qqCookie), signal())).resolves.toBe('QQ 音乐账号 · 尾号 5678')
    const [url, init] = fetcher.mock.calls[0]!
    expect(url).toBe('https://u.y.qq.com/cgi-bin/musicu.fcg')
    expect(init).toMatchObject({ redirect: 'manual', credentials: 'omit' })
    const cookie = new Headers(init?.headers).get('cookie')!
    expect(cookie).toContain('eas_sid=private-sid')
    expect(cookie).not.toContain('unrelated')
    expect(init?.body).toContain('GetLoginUserInfo')
    expect(init?.body).toContain('auth_tkn')
    expect(String(url)).not.toContain('abcdefghijklmnop')
  })
  it.each([{ info: {} }, { info: { nick: 'Name', uin: 87654321 } }])('rejects expired or mismatched account: %#', async (data) => {
    await expect(createQQHostedProvider(vi.fn().mockResolvedValue(rpc(data))).validate(parseQQCookie(qqCookie), signal())).rejects.toThrow(/失效|不匹配/)
  })
  it.each([{ code: 1000, message: qqCookie }, { code: 0, req_0: { code: 2000, message: qqCookie } }, { code: 0 }])('rejects both levels of business error without leaking upstream messages: %#', async (data) => {
    await expect(createQQHostedProvider(vi.fn().mockResolvedValue(Response.json(data))).validate(parseQQCookie(qqCookie), signal())).rejects.toThrow('会话不可用')
  })
  it('resolves only the target song and full filename, with session auth in the body', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValueOnce(rpc({ track_info: { mid, file: { media_mid: media } } }))
      .mockResolvedValueOnce(rpc({ sip: ['http://isure.stream.qqmusic.qq.com/'], midurlinfo: [{ songmid: mid, filename, purl: `${filename}?vkey=private` }] }))
    const source = await createQQHostedProvider(fetcher).resolve(parseQQCookie(qqCookie), mid, signal())
    expect(source.url).toBe(`https://isure.stream.qqmusic.qq.com/${filename}?vkey=private`)
    expect(source.hash).toBeUndefined()
    const body = JSON.parse(String(fetcher.mock.calls[1]?.[1]?.body))
    expect(body.req_0.param.songmid).toEqual([mid, mid, mid])
    expect(body.req_0.param.uin).toBe('12345678')
  })
  it.each(['', 'RS020preview.mp3', `https://evil.example/${filename}`, `../other.mp3`])('rejects missing, preview or unsafe playback location %s', async (purl) => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValueOnce(rpc({ track_info: { mid, file: { media_mid: media } } }))
      .mockResolvedValueOnce(rpc({ sip: ['https://isure.stream.qqmusic.qq.com/'], midurlinfo: [{ songmid: mid, filename, purl }] }))
    await expect(createQQHostedProvider(fetcher).resolve(parseQQCookie(qqCookie), mid, signal())).rejects.toThrow()
  })
  it.each(['qqmusic_uin=12345', 'uin=0; skey=abcdefgh', 'uin=12345; skey=abcdefgh\r\nleak', 'uin=12345; skey=abcdefgh; skey=duplicate'])('rejects malformed session %s', cookie => expect(() => parseQQCookie(cookie)).toThrow())
})

describe('BiliBili hosted adapter', () => {
  it('validates login status and strips unrelated cookies on the fixed API host', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(bili(nav))
    await expect(createBiliHostedProvider(fetcher).validate(parseBiliCookie(biliCookie), signal())).resolves.toBe('BiliBili 账号 · 尾号 5678')
    const [url, init] = fetcher.mock.calls[0]!
    expect(url).toBe('https://api.bilibili.com/x/web-interface/nav')
    expect(new Headers(init?.headers).get('cookie')).toBe('SESSDATA=abcdefghijklmnop%2C; bili_jct=abcdef; DedeUserID=12345678;')
    expect(init).toMatchObject({ redirect: 'manual', credentials: 'omit' })
  })
  it.each([{ ...nav, isLogin: false }, { ...nav, mid: 99999999 }])('rejects expired and mismatched identities: %#', async (data) => {
    await expect(createBiliHostedProvider(vi.fn().mockResolvedValue(bili(data))).validate(parseBiliCookie(biliCookie), signal())).rejects.toThrow(/失效|不匹配/)
  })
  it('signs playurl with fresh WBI keys and chooses AAC audio instead of video or Dolby', async () => {
    const { fetcher, result } = biliResolve({ ...dash, dash: { audio: [audio, { ...audio, id: 30251, bandwidth: 999999, baseUrl: 'https://invalid.example/hires' }], video: [{ baseUrl: 'https://invalid.example/video' }] } })
    await expect(result).resolves.toEqual({ url: audio.baseUrl })
    const url = new URL(String(fetcher.mock.calls[2]?.[0]))
    expect(url.origin).toBe('https://api.bilibili.com')
    expect(url.pathname).toBe('/x/player/wbi/playurl')
    expect(url.searchParams.get('cid')).toBe('123')
    expect(url.searchParams.get('w_rid')).toMatch(/^[a-f\d]{32}$/)
    expect(url.searchParams.has('wts')).toBe(true)
    expect(url.href).not.toContain('SESSDATA')
  })
  it.each([
    { ...dash, is_preview: 1 }, { ...dash, timelength: 30000 }, { ...dash, timelength: undefined }, { dash: { video: [audio] } },
    { ...dash, dash: { audio: [{ ...audio, codecs: 'avc1.123' }] } },
    { ...dash, dash: { audio: [{ ...audio, baseUrl: 'http://127.0.0.1/private' }] } },
  ])('rejects previews, partial timelines and unsafe tracks: %#', async (data) => { await expect(biliResolve(data).result).rejects.toThrow() })
  it.each(['', 'SESSDATA=short', 'SESSDATA=abcdefgh; SESSDATA=duplicate', 'SESSDATA=abcdefgh\nleak'])('rejects malformed session %s', cookie => expect(() => parseBiliCookie(cookie)).toThrow())
})

it.each([
  [validateQQMediaUrl, 'https://stream.qqmusic.qq.com.evil.example/a'], [validateQQMediaUrl, 'https://other.qq.com/a'],
  [validateBiliMediaUrl, 'https://bilivideo.com.evil.example/a'], [validateBiliMediaUrl, 'https://evil.akamaized.net/a'],
  [validateBiliMediaUrl, 'https://user:pass@upos.bilivideo.com/a'], [validateQQMediaUrl, 'https://stream.qqmusic.qq.com:8443/a'],
] as const)('rejects media host bypass %#', (validate, url) => { expect(() => validate(url)).toThrow() })

it.each([createQQHostedProvider, createBiliHostedProvider])('bounds JSON and refuses API redirects: %#', async (create) => {
  const cookie = create === createQQHostedProvider ? parseQQCookie(qqCookie) : parseBiliCookie(biliCookie)
  const fetcher = vi.fn<typeof fetch>().mockResolvedValueOnce(new Response(' '.repeat(129 * 1024))).mockResolvedValueOnce(new Response(null, { status: 302, headers: { location: 'https://evil.example' } }))
  await expect(create(fetcher).validate(cookie, signal())).rejects.toThrow('过大')
  await expect(create(fetcher).validate(cookie, signal())).rejects.toThrow('托管请求失败')
})
