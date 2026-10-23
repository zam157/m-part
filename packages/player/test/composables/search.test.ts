import { flush } from 'solid-js'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { biliSearch, neteaseSearch, playlistSearch } = vi.hoisted(() => ({ biliSearch: vi.fn(), neteaseSearch: vi.fn(), playlistSearch: vi.fn() }))
vi.mock('@m-part/music/providers', () => ({
  providers: {
    bili: { name: 'bili', search: biliSearch },
    netease: { name: 'netease', search: neteaseSearch, searchPlaylist: playlistSearch },
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
    search.setSelectedType('music')
    flush()
    biliSearch.mockReset().mockResolvedValue([[biliSong], page])
    neteaseSearch.mockReset().mockResolvedValue([[neteaseSong], page])
    playlistSearch.mockReset().mockResolvedValue([[{ provider: 'netease', id: '42', title: '公开歌单', coverUrl: '', totalTracks: 30 }], page])
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

  it('歌单搜索写入独立结果，并在切换不支持的音源时重置类型和结果', async () => {
    search.setSelectedSource('netease')
    search.setSelectedType('playlist')
    flush()
    expect(search.availableTypeOptions().find(item => item.value === 'playlist')?.disabled).toBe(false)
    await search.handleSearch(2, 'playlist')
    flush()
    expect(playlistSearch).toHaveBeenCalledWith('关键词', 2)
    expect(search.searchType()).toBe('playlist')
    expect(search.currentResults()).toEqual(search.playlistResults())
    expect(search.playlistResults()[0]?.id).toBe('42')
    search.setSelectedSource('bili')
    flush()
    expect(search.selectedType()).toBe('music')
    expect(search.playlistResults()).toEqual([])
    expect(search.availableTypeOptions().find(item => item.value === 'playlist')?.disabled).toBe(true)
  })

  it('歌单请求失败显示错误并清理结果，重试后恢复', async () => {
    search.setSelectedSource('netease')
    flush()
    playlistSearch.mockRejectedValueOnce(new Error('歌单暂不可用'))
    await search.handleSearch(1, 'playlist')
    flush()
    expect(search.searchError()).toBe('歌单暂不可用')
    expect(search.currentResults()).toEqual([])
    await search.handleSearch(1, 'playlist')
    flush()
    expect(search.searchError()).toBeNull()
    expect(search.playlistResults()).toHaveLength(1)
  })

  it('迟到的歌单搜索结果不能覆盖切换后的歌曲结果', async () => {
    let finish!: (value: unknown) => void
    search.setSelectedSource('netease')
    flush()
    playlistSearch.mockReturnValueOnce(new Promise(resolve => { finish = resolve }))
    const pending = search.handleSearch(1, 'playlist')
    flush()
    search.setSelectedSource('bili')
    flush()
    await search.handleSearch(1, 'music')
    flush()
    finish([[{ id: 'old' }], page])
    await pending
    flush()
    expect(search.searchType()).toBe('music')
    expect(search.musicResults()).toEqual([biliSong])
    expect(search.playlistResults()).toEqual([])
  })
})
