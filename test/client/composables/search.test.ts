import { flush } from 'solid-js'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { biliSearch, neteaseSearch } = vi.hoisted(() => ({ biliSearch: vi.fn(), neteaseSearch: vi.fn() }))
vi.mock('#shared/utils/providers/index', () => ({
  providers: {
    bili: { name: 'bili', search: biliSearch },
    netease: { name: 'netease', search: neteaseSearch },
  },
}))
const search = await import('~/composables/search')
const page = { page: 1, pageSize: 20, total: 1 }
const biliSong = { provider: 'bili', id: 'bili', title: 'Bili', duration: 1, coverUrl: '' }
const neteaseSong = { ...biliSong, provider: 'netease', id: 'netease' }

describe('切换音源', () => {
  beforeEach(() => {
    search.setSelectedSource('netease')
    flush()
    search.setSelectedSource('bili')
    search.setKeyword('关键词')
    flush()
    biliSearch.mockReset().mockResolvedValue([[biliSong], page])
    neteaseSearch.mockReset().mockResolvedValue([[neteaseSong], page])
  })

  it('切换音源后清除旧结果与分页', async () => {
    await search.handleSearch(1, 'music')
    flush()
    expect(search.musicResults()).toEqual([biliSong])
    search.setSelectedSource('netease')
    flush()
    expect(search.musicResults()).toEqual([])
    expect(search.hasSearched()).toBe(false)
    expect(search.pagination().total).toBe(0)
    await search.handleSearch(1, 'music')
    flush()
    expect(search.musicResults()).toEqual([neteaseSong])
  })

  it('在途旧响应不能覆盖新音源的搜索结果', async () => {
    let finish!: (value: unknown) => void
    biliSearch.mockReturnValue(new Promise(resolve => { finish = resolve }))
    const pending = search.handleSearch(1, 'music')
    flush()
    search.setSelectedSource('netease')
    flush()
    await search.handleSearch(1, 'music')
    flush()
    finish([[biliSong], page])
    await pending
    flush()
    expect(search.musicResults()).toEqual([neteaseSong])
    expect(search.searching()).toBe(false)
  })
})
