import { beforeEach, describe, expect, it, vi } from 'vitest'

const { request } = vi.hoisted(() => ({ request: vi.fn() }))
vi.mock('../src/utils/fetch', () => ({ tRequest: request }))
vi.mock('../src/utils/constants', () => ({ TARGET_EXTENSION: true, USE_PROXY: false, USE_GM_FETCH: false }))
const { default: provider } = await import('../src/utils/providers/bilibili')

describe('BiliBili 首页推荐', () => {
  beforeEach(() => request.mockReset())

  it('只请求音乐分区榜单，保留可播放 ID、作者与时长并升级封面协议', async () => {
    request.mockResolvedValue([true, { code: 0, data: [{
      bvid: 'BVmusic', title: '音乐现场', author: '歌手', duration: '1:02:03',
      pic: '//i1.hdslb.com/cover.jpg', typename: '音乐现场', description: '介绍',
    }] }])
    expect(await provider.getRecommendations()).toEqual([{
      provider: 'bili', id: 'BVmusic', title: '音乐现场', artist: '歌手', duration: 3723,
      coverUrl: 'https://i1.hdslb.com/cover.jpg', album: '音乐现场', description: '介绍',
    }])
    expect(request).toHaveBeenCalledWith('https://api.bilibili.com/x/web-interface/ranking/region', expect.objectContaining({ searchParams: { rid: 3, day: 3 } }))
  })

  it('无推荐时返回空数组，风控与网络失败则向调用者报告错误', async () => {
    request.mockResolvedValueOnce([true, { code: 0, data: [] }])
    expect(await provider.getRecommendations()).toEqual([])
    request.mockResolvedValueOnce([true, { code: -352, message: '请求被拦截' }])
    await expect(provider.getRecommendations()).rejects.toThrow('请求被拦截')
    request.mockResolvedValueOnce([false, 503, 'Unavailable'])
    await expect(provider.getRecommendations()).rejects.toThrow('Unavailable')
  })
})
