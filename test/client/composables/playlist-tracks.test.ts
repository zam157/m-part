import { flush } from 'solid-js'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { LoginRequiredError } from '#shared/utils/providers/login-required'

const { getPlaylist } = vi.hoisted(() => ({ getPlaylist: vi.fn() }))
vi.mock('#shared/utils/providers/index', () => ({ providers: { bili: { getPlaylist } } }))
const { createPlaylistTracks } = await import('~/composables/playlist-tracks')
const song = { provider: 'bili', id: 'BV1', title: '歌曲', coverUrl: '', duration: 60 }
beforeEach(() => getPlaylist.mockReset())

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
})
