import { beforeEach, describe, expect, it, vi } from 'vitest'
import { biliPages, parseBiliTrackId, selectBiliPage } from '../src/utils/providers/bilibili-parts'
import { generateWbiSignInfo } from '../src/utils/providers/bilibili-wbi'
const { request } = vi.hoisted(() => ({ request: vi.fn() }))
vi.mock('../src/utils/fetch', () => ({ tRequest: request }))
vi.mock('../src/utils/constants', () => ({ TARGET_EXTENSION: true, USE_PROXY: false, USE_GM_FETCH: false }))
const { default: provider } = await import('../src/utils/providers/bilibili')
const music = { provider: 'bili' as const, id: 'BV1234567890', title: '整部视频', duration: 9999, coverUrl: '' }
const pages = [{ cid: 123, page: 1, part: '第一首', duration: 120 }, { cid: 456, page: 2, part: '第二首', duration: 180 }]
const video = { bvid: music.id, cid: 123, title: music.title, duration: 300, pages }
const ok = (data: unknown) => [true, { code: 0, data }]

beforeEach(() => {
  request.mockReset().mockImplementation(async (url: string, options: { searchParams?: { cid?: number } }) => {
    if (url.endsWith('/nav')) return ok({ wbi_img: { img_url: `https://i0.hdslb.com/${'a'.repeat(32)}.png`, sub_url: `https://i0.hdslb.com/${'b'.repeat(32)}.png` } })
    if (url.endsWith('/view')) return ok(video)
    return ok({ timelength: (options.searchParams?.cid === 456 ? 180 : 120) * 1000, dash: { audio: [{ id: 30280, baseUrl: 'https://example.com/audio.m4s' }] } })
  })
})

describe('BiliBili individual pages', () => {
  it('returns stable CID identities and each page duration instead of container totals', async () => {
    const tracks = await provider.getTrackParts(music)
    expect(tracks.map(t => [t.id, t.duration])).toEqual([['BV1234567890:123', 120], ['BV1234567890:456', 180]])
    expect(tracks[1]?.title).toContain('P2 · 第二首')
    expect(request).toHaveBeenCalledOnce()
  })
  it('loads P2 using its CID and signs the request with keys without filename extensions', async () => {
    const source = await provider.getSourceInfo({ ...music, id: `${music.id}:456`, duration: 180 })
    expect(source.track).toMatchObject({ id: 'BV1234567890:456', duration: 180 })
    const [, options] = request.mock.calls.find(([url]) => url.endsWith('/playurl'))!
    expect(options.searchParams).toMatchObject({ bvid: music.id, cid: 456 })
    const { w_rid, ...params } = options.searchParams
    expect(w_rid).toBe(generateWbiSignInfo(params, 'a'.repeat(32), 'b'.repeat(32)).w_rid)
  })
  it('resolves legacy BV-only queue entries to P1 and corrects the title and duration', async () => {
    const source = await provider.getSourceInfo(music)
    expect(source.track).toMatchObject({ id: `${music.id}:123`, duration: 120 })
  })
  it('does not silently fall back to P1 when a selected CID has disappeared', async () => {
    await expect(provider.getSourceInfo({ ...music, id: `${music.id}:999` })).rejects.toThrow('不存在')
    expect(request.mock.calls.some(([url]) => url.endsWith('/playurl'))).toBe(false)
  })
  it('rejects preview or truncated audio even when its length could match the full video total', async () => {
    request.mockImplementation(async (url: string) => url.endsWith('/view') ? ok(video) : url.endsWith('/nav') ? ok({ wbi_img: { img_url: `https://i0.hdslb.com/${'a'.repeat(32)}.png`, sub_url: `https://i0.hdslb.com/${'b'.repeat(32)}.png` } }) : ok({ timelength: 300000, is_preview: 1, dash: { audio: [{ id: 30280, baseUrl: 'https://example.com/audio' }] } }))
    await expect(provider.getSourceInfo(music)).rejects.toThrow('完整音轨')
  })
  it('keeps CIDs stable after page reordering and rejects unsafe or foreign identities', () => {
    expect(selectBiliPage({ ...video, pages: [{ ...pages[1]!, page: 1 }, { ...pages[0]!, page: 2 }] }, 123).duration).toBe(120)
    expect(() => selectBiliPage(video, 999)).toThrow('不属于')
    for (const id of ['https://evil.example', 'BV1234567890:0', 'BV1234567890:9007199254740992', 'BV1234567890:123?ticket=private']) expect(() => parseBiliTrackId(id)).toThrow()
    expect(() => biliPages({ ...video, pages: [pages[0]!, pages[0]!] })).toThrow()
  })
})
