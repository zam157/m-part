import { flush } from 'solid-js'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { biliUser, neteaseUser, biliLists, neteaseLists } = vi.hoisted(() => ({ biliUser: vi.fn(), neteaseUser: vi.fn(), biliLists: vi.fn(), neteaseLists: vi.fn() }))
vi.mock('#shared/utils/providers/index', () => ({ providers: {
  bili: { getCurrentUser: biliUser, getPlaylists: biliLists },
  netease: { getCurrentUser: neteaseUser, getPlaylists: neteaseLists },
} }))

const user = { id: '7', name: '用户' }
const playlist = { provider: 'bili', id: '1', title: '歌单', coverUrl: '', totalTracks: 1, owned: true }
let library: typeof import('~/composables/playlists')

beforeEach(async () => {
  vi.resetModules()
  biliUser.mockReset().mockResolvedValue(user)
  neteaseUser.mockReset().mockResolvedValue({ id: '8', name: '另一用户' })
  biliLists.mockReset().mockResolvedValue({ items: [playlist], hasMore: false })
  neteaseLists.mockReset().mockResolvedValue({ items: [{ ...playlist, provider: 'netease', id: '2' }], hasMore: false })
  library = await import('~/composables/playlists')
})

describe('收藏歌单状态', () => {
  it('未登录不继续请求歌单，登录后刷新读取当前账号', async () => {
    biliUser.mockResolvedValueOnce(null)
    await library.loadPlaylists('bili')
    flush()
    expect(library.playlistLibrary()).toMatchObject({ loaded: true, user: null, items: [], error: null })
    expect(biliLists).not.toHaveBeenCalled()
    await library.loadPlaylists('bili', { refresh: true })
    flush()
    expect(biliLists).toHaveBeenCalledWith('7', 1)
    expect(library.playlistLibrary().items).toEqual([playlist])
  })

  it('分页去重，不混合两个音源的歌单', async () => {
    biliLists.mockResolvedValueOnce({ items: [playlist], hasMore: true })
    await library.loadPlaylists('bili')
    flush()
    biliLists.mockResolvedValueOnce({ items: [playlist, { ...playlist, id: '3' }], hasMore: false })
    await library.loadPlaylists('bili', { more: true })
    flush()
    expect(library.playlistLibrary().items.map(item => item.id)).toEqual(['1', '3'])
    expect(biliLists).toHaveBeenLastCalledWith('7', 2)
    await library.loadPlaylists('netease')
    flush()
    expect(library.playlistLibrary().items.map(item => item.id)).toEqual(['2'])
    expect(neteaseLists).toHaveBeenCalledWith('8', 1)
  })

  it('快速切换音源忽略迟到响应', async () => {
    let finish!: (value: unknown) => void
    biliLists.mockReturnValueOnce(new Promise(resolve => { finish = resolve }))
    const previous = library.loadPlaylists('bili')
    await vi.waitFor(() => expect(biliLists).toHaveBeenCalled())
    await library.loadPlaylists('netease')
    flush()
    finish({ items: [playlist], hasMore: false })
    await previous
    flush()
    expect(library.playlistLibrary().source).toBe('netease')
    expect(library.playlistLibrary().items[0]?.provider).toBe('netease')
  })

  it('在途音源切换被缓存命中撤销时，也不能覆盖当前列表', async () => {
    await library.loadPlaylists('bili')
    flush()
    const pending = library.loadPlaylists('netease')
    await library.loadPlaylists('bili')
    await pending
    flush()
    expect(library.playlistLibrary().source).toBe('bili')
    expect(neteaseLists).not.toHaveBeenCalled()
  })

  it('刷新后不会继续展示旧账号数据，网络错误可重试', async () => {
    await library.loadPlaylists('bili')
    flush()
    biliUser.mockResolvedValueOnce({ id: '9', name: '新账号' })
    biliLists.mockRejectedValueOnce(new Error('网络异常'))
    await library.loadPlaylists('bili', { refresh: true })
    flush()
    expect(library.playlistLibrary()).toMatchObject({ items: [], error: '网络异常' })
    expect(biliLists).toHaveBeenLastCalledWith('9', 1)
    await library.loadPlaylists('bili', { refresh: true })
    flush()
    expect(library.playlistLibrary().error).toBeNull()
  })

  it('凭据过期时清空旧账号收藏并恢复登录提示', async () => {
    await library.loadPlaylists('bili')
    flush()
    const { LoginRequiredError } = await import('#shared/utils/providers/login-required')
    biliLists.mockRejectedValueOnce(new LoginRequiredError())
    await library.loadPlaylists('bili', { refresh: true })
    flush()
    expect(library.playlistLibrary()).toMatchObject({ loaded: true, user: null, items: [], error: null })
  })
})
