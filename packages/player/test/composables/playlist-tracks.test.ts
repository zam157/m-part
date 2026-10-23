import { flush } from 'solid-js'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { LoginRequiredError } from '@m-part/music/providers/login-required'

const { getPlaylist, getAllPlaylistTracks } = vi.hoisted(() => ({ getPlaylist: vi.fn(), getAllPlaylistTracks: vi.fn() }))
vi.mock('@m-part/music/providers', () => ({ providers: { bili: { getPlaylist }, netease: { getPlaylist, getAllPlaylistTracks } } }))
const { createPlaylistTracks } = await import('~/composables/playlist-tracks')
const song = { provider: 'bili', id: 'BV1', title: '歌曲', coverUrl: '', duration: 60 }
beforeEach(() => { getPlaylist.mockReset(); getAllPlaylistTracks.mockReset() })

describe('歌单曲目加载', () => {
  it('按序追加曲目并去重，重复点击只发送一次请求', async () => {
    const tracks = createPlaylistTracks('bili', '9')
    getPlaylist.mockResolvedValueOnce({ items: [song], hasMore: true })
    const first = tracks.load()
    expect(tracks.load()).toBe(first)
    await first
    flush()
    getPlaylist.mockResolvedValueOnce({ items: [song, { ...song, id: 'BV2' }], hasMore: false })
    await tracks.load()
    flush()
    expect(tracks.state().items.map(item => item.id)).toEqual(['BV1', 'BV2'])
    expect(getPlaylist.mock.calls).toEqual([['9', 1], ['9', 2]])
  })

  it('下一页失败保留已加载歌曲，重试仍请求失败的页', async () => {
    const tracks = createPlaylistTracks('bili', '9')
    getPlaylist.mockResolvedValueOnce({ items: [song], hasMore: true })
    await tracks.load()
    flush()
    getPlaylist.mockRejectedValueOnce(new Error('断网'))
    await tracks.load()
    flush()
    expect(tracks.state()).toMatchObject({ page: 1, items: [song], error: '断网', loading: false })
    getPlaylist.mockResolvedValueOnce({ items: [], hasMore: false })
    await tracks.load()
    expect(getPlaylist).toHaveBeenLastCalledWith('9', 2)
  })

  it('登录过期清空曲目并提示登录', async () => {
    const tracks = createPlaylistTracks('bili', '9')
    getPlaylist.mockRejectedValueOnce(new LoginRequiredError())
    await tracks.load()
    flush()
    expect(tracks.state()).toMatchObject({ items: [], loginRequired: true, error: null, loading: false })
  })

  it('离开详情后忽略在途响应', async () => {
    let finish!: (value: unknown) => void
    const tracks = createPlaylistTracks('bili', '9')
    getPlaylist.mockReturnValueOnce(new Promise(resolve => { finish = resolve }))
    const pending = tracks.load()
    await vi.waitFor(() => expect(getPlaylist).toHaveBeenCalled())
    tracks.dispose()
    finish({ items: [song], hasMore: false })
    await pending
    flush()
    expect(tracks.state().items).toEqual([])
  })

  it('一键读取剩余全部页面，保持顺序、去重并继续翻过过滤后为空的页面', async () => {
    const tracks = createPlaylistTracks('bili', '9')
    getPlaylist.mockResolvedValueOnce({ items: [song], hasMore: true })
    await tracks.load()
    getPlaylist.mockResolvedValueOnce({ items: [], hasMore: true })
    getPlaylist.mockResolvedValueOnce({ items: [song, { ...song, id: 'BV2' }], hasMore: false })
    expect((await tracks.loadAll())?.map(item => item.id)).toEqual(['BV1', 'BV2'])
    flush()
    expect(getPlaylist.mock.calls).toEqual([['9', 1], ['9', 2], ['9', 3]])
    expect(tracks.state()).toMatchObject({ page: 3, hasMore: false, loading: false })
    expect(tracks.loadingAll()).toBe(false)
  })

  it('复用正在加载的第一页，重复一键读取只启动一次批量任务', async () => {
    let finish!: (value: unknown) => void
    const tracks = createPlaylistTracks('bili', '9')
    getPlaylist.mockReturnValueOnce(new Promise(resolve => { finish = resolve }))
    const first = tracks.load()
    const all = tracks.loadAll()
    expect(tracks.loadAll()).toBe(all)
    await vi.waitFor(() => expect(getPlaylist).toHaveBeenCalledTimes(1))
    flush()
    expect(tracks.loadingAll()).toBe(true)
    finish({ items: [song], hasMore: false })
    await first
    expect(await all).toEqual([song])
    expect(getPlaylist).toHaveBeenCalledTimes(1)
  })

  it('整单读取失败不返回半份歌单，重试从失败的页继续', async () => {
    const tracks = createPlaylistTracks('bili', '9')
    getPlaylist.mockResolvedValueOnce({ items: [song], hasMore: true })
    getPlaylist.mockRejectedValueOnce(new Error('断网'))
    expect(await tracks.loadAll()).toBeNull()
    flush()
    expect(tracks.state()).toMatchObject({ items: [song], page: 1, error: '断网' })
    expect(tracks.loadingAll()).toBe(false)
    getPlaylist.mockResolvedValueOnce({ items: [{ ...song, id: 'BV2' }], hasMore: false })
    expect((await tracks.loadAll())?.map(item => item.id)).toEqual(['BV1', 'BV2'])
    expect(getPlaylist.mock.calls).toEqual([['9', 1], ['9', 2], ['9', 2]])
  })

  it('离开页面后停止读取剩余页且不返回可用于更新播放队列的结果', async () => {
    let finish!: (value: unknown) => void
    const tracks = createPlaylistTracks('bili', '9')
    getPlaylist.mockResolvedValueOnce({ items: [song], hasMore: true })
    getPlaylist.mockReturnValueOnce(new Promise(resolve => { finish = resolve }))
    const pending = tracks.loadAll()
    await vi.waitFor(() => expect(getPlaylist).toHaveBeenCalledTimes(2))
    tracks.dispose()
    finish({ items: [{ ...song, id: 'BV2' }], hasMore: true })
    expect(await pending).toBeNull()
    expect(getPlaylist).toHaveBeenCalledTimes(2)
    expect(await tracks.loadAll()).toBeNull()
  })

  it('已经读完的歌单直接复用，不重复请求', async () => {
    const tracks = createPlaylistTracks('bili', '9')
    getPlaylist.mockResolvedValueOnce({ items: [song], hasMore: false })
    await tracks.load()
    expect(await tracks.loadAll()).toEqual([song])
    expect(getPlaylist).toHaveBeenCalledTimes(1)
  })

  it('音源提供整单能力时优先使用，不再循环分页，并复用已有曲目', async () => {
    const tracks = createPlaylistTracks('netease', '10')
    getPlaylist.mockResolvedValueOnce({ items: [song], hasMore: true })
    await tracks.load()
    flush()
    getAllPlaylistTracks.mockImplementationOnce(async (_id, options) => {
      options.onProgress({ items: [song], total: 2 })
      return [song, { ...song, id: '2' }]
    })
    expect((await tracks.loadAll())?.map(item => item.id)).toEqual(['BV1', '2'])
    flush()
    expect(getPlaylist).toHaveBeenCalledTimes(1)
    expect(getAllPlaylistTracks).toHaveBeenCalledWith('10', expect.objectContaining({ knownItems: [song], signal: expect.any(AbortSignal) }))
    expect(tracks.state()).toMatchObject({ hasMore: false, loading: false, error: null })
    await tracks.loadAll()
    expect(getAllPlaylistTracks).toHaveBeenCalledTimes(1)
  })

  it('整单接口失败保留已完成批次，重试不退回 20 首分页', async () => {
    const tracks = createPlaylistTracks('netease', '10')
    const partial = [song, { ...song, id: '2' }]
    getAllPlaylistTracks.mockImplementationOnce(async (_id, options) => {
      options.onProgress({ items: partial, total: 3 })
      throw new Error('批次失败')
    })
    expect(await tracks.loadAll()).toBeNull()
    flush()
    expect(tracks.state()).toMatchObject({ items: partial, hasMore: true, error: '批次失败', loading: false })
    getAllPlaylistTracks.mockResolvedValueOnce([...partial, { ...song, id: '3' }])
    expect((await tracks.loadAll())?.length).toBe(3)
    expect(getPlaylist).not.toHaveBeenCalled()
    expect(getAllPlaylistTracks).toHaveBeenLastCalledWith('10', expect.objectContaining({ knownItems: partial }))
  })

  it('离开页面会取消整单请求，不提交迟到进度和队列结果', async () => {
    const tracks = createPlaylistTracks('netease', '10')
    let finish!: (value: unknown) => void
    getAllPlaylistTracks.mockReturnValueOnce(new Promise(resolve => { finish = resolve }))
    const pending = tracks.loadAll()
    await vi.waitFor(() => expect(getAllPlaylistTracks).toHaveBeenCalled())
    const options = getAllPlaylistTracks.mock.calls[0]![1]
    tracks.dispose()
    expect(options.signal.aborted).toBe(true)
    options.onProgress({ items: [song], total: 1 })
    finish([song])
    expect(await pending).toBeNull()
    flush()
    expect(tracks.state().items).toEqual([])
  })
})
