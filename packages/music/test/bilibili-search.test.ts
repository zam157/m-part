import { beforeEach, describe, expect, it, vi } from 'vitest'

const { request } = vi.hoisted(() => ({ request: vi.fn() }))
vi.mock('../src/utils/fetch', () => ({ tRequest: request }))
vi.mock('../src/utils/constants', () => ({ TARGET_EXTENSION: true, USE_PROXY: false, USE_GM_FETCH: false }))
const { default: provider } = await import('../src/utils/providers/bilibili')
const titles = [
  '<em class="keyword">周杰伦</em> &amp; &#34;现场&#34; &#x1F3B5; &lt;夜&gt;',
  "<EM class='keyword'>高亮</EM> &nbsp; &#39;单引号&#39; &copy;",
  '&lt;em class=&quot;keyword&quot;&gt;原名&lt;/em&gt; &amp;amp;',
  '普通歌名 2 < 3 > 1 · A&B',
]

beforeEach(() => {
  request.mockReset().mockImplementation(async (url: string) => {
    if (url.endsWith('/nav')) return [true, { code: 0, data: { wbi_img: { img_url: `https://i0.hdslb.com/${'a'.repeat(32)}.png`, sub_url: `https://i0.hdslb.com/${'b'.repeat(32)}.png` } } }]
    return [true, { code: 0, data: {
      result: titles.map((title, index) => ({ bvid: `BV${index}`, title, author: '歌手', duration: '2:00', pic: '//i0.hdslb.com/cover.jpg' })),
      page: 1, pagesize: 20, numResults: 4,
    } }]
  })
})

describe('BiliBili search title normalization', () => {
  it('removes API highlighting and decodes named, decimal and hexadecimal HTML entities exactly once', async () => {
    const [songs] = await provider.search('周杰伦', 1)
    expect(songs.map(song => song.title)).toEqual([
      '周杰伦 & "现场" 🎵 <夜>',
      "高亮 \u00a0 '单引号' ©",
      '<em class="keyword">原名</em> &amp;',
      '普通歌名 2 < 3 > 1 · A&B',
    ])
  })
  it('preserves API ordering and pagination without fetching each video or changing search sorting', async () => {
    const [songs, page] = await provider.search('周杰伦', 1)
    expect(songs.map(song => song.id)).toEqual(['BV0', 'BV1', 'BV2', 'BV3'])
    expect(page).toEqual({ page: 1, pageSize: 20, total: 4 })
    const searches = request.mock.calls.filter(([url]) => url.endsWith('/wbi/search/type'))
    expect(searches).toHaveLength(1)
    expect(searches[0]![1].searchParams).toMatchObject({ keyword: '周杰伦', search_type: 'video', page: 1, page_size: 20 })
    expect(searches[0]![1].searchParams).not.toHaveProperty('order')
    expect(searches[0]![1].searchParams).not.toHaveProperty('highlight')
    expect(request.mock.calls.some(([url]) => url.endsWith('/view'))).toBe(false)
  })
})
