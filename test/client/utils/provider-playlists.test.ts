import { beforeEach, describe, expect, it, vi } from 'vitest'

const { request, encrypt } = vi.hoisted(() => ({ request: vi.fn(), encrypt: vi.fn() }))
vi.mock('#shared/utils/fetch', () => ({ tRequest: request }))
vi.mock('#shared/utils/constants', () => ({ TARGET_EXTENSION: true, USE_PROXY: false, USE_GM_FETCH: false }))
vi.mock('#shared/utils/providers/netease-crypto', () => ({ encryptWeapi: encrypt }))
vi.mock('#shared/utils/providers/netease-session', () => ({ getNeteaseCsrfToken: async () => 'session-csrf' }))
const { default: bili } = await import('#shared/utils/providers/bilibili')
const { default: netease } = await import('#shared/utils/providers/netease')
const { LoginRequiredError } = await import('#shared/utils/providers/login-required')

beforeEach(() => {
  request.mockReset()
  encrypt.mockReset().mockReturnValue({ params: 'encrypted', encSecKey: 'rsa' })
})

describe('已登录用户与收藏歌单', () => {
  it('BiliBili 通过 nav 读取账号，不把风控与网络错误当作未登录', async () => {
    request.mockResolvedValueOnce([true, { code: 0, data: { isLogin: true, mid: 7, uname: '用户', face: '//i1.hdslb.com/a.jpg' } }])
    expect(await bili.getCurrentUser()).toMatchObject({ id: '7', name: '用户', coverUrl: 'https://i1.hdslb.com/a.jpg' })
    request.mockResolvedValueOnce([true, { code: -101 }])
    expect(await bili.getCurrentUser()).toBeNull()
    request.mockResolvedValueOnce([true, { code: -352, message: '风控' }])
    await expect(bili.getCurrentUser()).rejects.toThrow('风控')
    request.mockRejectedValueOnce(new Error('Offline'))
    await expect(bili.getCurrentUser()).rejects.toThrow('Offline')
  })

  it('BiliBili 首批合并自己的收藏夹与他人歌单，后续只翻页收藏列表', async () => {
    request.mockResolvedValueOnce([true, { code: 0, data: { list: [{ id: 10, title: '他人歌单', media_count: 2, upper: { name: '作者' }, cover: 'http://i1.hdslb.com/p.jpg' }], has_more: true } }])
    request.mockResolvedValueOnce([true, { code: 0, data: { list: [{ id: 9, title: '我的收藏夹', media_count: 3 }] } }])
    const first = await bili.getPlaylists('7', 1)
    expect(first).toMatchObject({ items: [{ id: '9', owned: true, totalTracks: 3 }, { id: '10', owned: false, creator: '作者', coverUrl: 'https://i1.hdslb.com/p.jpg' }], hasMore: true })
    request.mockResolvedValueOnce([true, { code: 0, data: { list: [], has_more: false } }])
    expect(await bili.getPlaylists('7', 2)).toEqual({ items: [], hasMore: false })
    expect(request).toHaveBeenLastCalledWith(expect.stringContaining('/collected/list'), expect.objectContaining({ searchParams: { up_mid: '7', pn: 2, ps: 20, platform: 'web' } }))
    expect(request).toHaveBeenCalledTimes(3)
  })

  it('BiliBili 空收藏夹可为空 data，过期凭据明确返回登录异常', async () => {
    request.mockResolvedValueOnce([true, { code: 0, data: { list: null, has_more: false } }])
    request.mockResolvedValueOnce([true, { code: 0, data: null }])
    expect(await bili.getPlaylists('7', 1)).toEqual({ items: [], hasMore: false })
    request.mockResolvedValueOnce([true, { code: -101, message: '未登录' }])
    await expect(bili.getPlaylists('7', 1)).rejects.toBeInstanceOf(LoginRequiredError)
  })

  it('BiliBili 过滤失效和非视频资源，曲目分页沿用原始 has_more', async () => {
    const item = { type: 2, bvid: 'BV1', title: '歌曲', cover: '//i1.hdslb.com/p.jpg', duration: 80, upper: { name: '歌手' }, attr: 0 }
    request.mockResolvedValueOnce([true, { code: 0, data: { medias: [item, { ...item, bvid: 'BV2', attr: 1 }, { ...item, bvid: 'BV3', type: 12 }], has_more: true } }])
    expect(await bili.getPlaylist('9', 2)).toMatchObject({ items: [{ provider: 'bili', id: 'BV1', duration: 80, artist: '歌手', coverUrl: 'https://i1.hdslb.com/p.jpg' }], hasMore: true })
    expect(request).toHaveBeenCalledWith(expect.stringContaining('/resource/list'), expect.objectContaining({ searchParams: expect.objectContaining({ media_id: '9', pn: 2, ps: 20 }) }))
  })

  it('网易云读取当前账号并使用会话 CSRF，未登录与接口故障分开处理', async () => {
    request.mockResolvedValueOnce([true, { code: 200, account: { id: 7 }, profile: { userId: 7, nickname: '用户', avatarUrl: '//p1.music.126.net/a.jpg' } }])
    expect(await netease.getCurrentUser!()).toEqual({ id: '7', name: '用户', coverUrl: 'https://p1.music.126.net/a.jpg' })
    expect(encrypt).toHaveBeenCalledWith({ csrf_token: 'session-csrf' })
    expect(request).toHaveBeenLastCalledWith('https://music.163.com/weapi/w/nuser/account/get', expect.objectContaining({ method: 'POST' }))
    request.mockResolvedValueOnce([true, { code: 200, account: null, profile: null }])
    expect(await netease.getCurrentUser!()).toBeNull()
    request.mockResolvedValueOnce([true, { code: 301 }])
    expect(await netease.getCurrentUser!()).toBeNull()
    request.mockResolvedValueOnce([true, { code: 500, msg: '服务故障' }])
    await expect(netease.getCurrentUser!()).rejects.toThrow('服务故障')
  })

  it('网易云按当前账号分页获取创建和收藏的歌单，并标记归属', async () => {
    request.mockResolvedValueOnce([true, { code: 200, playlist: [
      { id: 10, name: '我的歌单', trackCount: 30, creator: { userId: 7, nickname: '用户' } },
      { id: 11, name: '收藏的歌单', trackCount: 2, coverImgUrl: 'http://p1.music.126.net/a.jpg', creator: { userId: 8, nickname: '朋友' } },
    ], more: true }])
    expect(await netease.getPlaylists!('7', 2)).toMatchObject({ items: [{ id: '10', owned: true, totalTracks: 30 }, { id: '11', owned: false, creator: '朋友', coverUrl: 'https://p1.music.126.net/a.jpg' }], hasMore: true })
    expect(encrypt).toHaveBeenCalledWith(expect.objectContaining({ uid: '7', offset: 20, limit: 20 }))
  })

  it('网易云使用 trackIds 处理被截断的 tracks，按歌单顺序读取后续页并跳过已下架歌曲', async () => {
    request.mockResolvedValueOnce([true, { code: 200, playlist: { tracks: [], trackIds: Array.from({ length: 23 }, (_, id) => ({ id })) } }])
    request.mockResolvedValueOnce([true, { code: 200, songs: [
      { id: 22, name: '后', dt: 90000, ar: [{ name: '歌手' }], al: { name: '专辑', picUrl: '//p1.music.126.net/a.jpg' } },
      { id: 20, name: '前', dt: 5000 },
    ] }])
    const result = await netease.getPlaylist!('10', 2)
    expect(result.items.map(item => item.id)).toEqual(['20', '22'])
    expect(result.items[1]).toMatchObject({ provider: 'netease', duration: 90, coverUrl: 'https://p1.music.126.net/a.jpg' })
    expect(result.hasMore).toBe(false)
    expect(encrypt).toHaveBeenLastCalledWith(expect.objectContaining({ c: '[{"id":20},{"id":21},{"id":22}]' }))
  })
})
