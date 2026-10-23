import { flush } from 'solid-js'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { bili, netease } = vi.hoisted(() => ({ bili: vi.fn(), netease: vi.fn() }))
vi.mock('@m-part/music/providers', () => ({ providers: {
  bili: { name: 'bili', getRecommendations: bili },
  netease: { name: 'netease', getRecommendations: netease },
} }))

const song = { provider: 'bili', id: '1', title: '音乐', duration: 60, coverUrl: '' }
let home: typeof import('~/composables/recommendations')

describe('首页推荐状态', () => {
  beforeEach(async () => {
    vi.resetModules()
    bili.mockReset().mockResolvedValue([song])
    netease.mockReset().mockResolvedValue([])
    home = await import('~/composables/recommendations')
  })

  it('两个音源独立完成，单个失败不会清空另一个的推荐，且可以重试', async () => {
    netease.mockRejectedValueOnce(new Error('网络异常'))
    await Promise.all([home.loadRecommendations('bili'), home.loadRecommendations('netease')])
    flush()
    expect(home.recommendations().bili.items).toEqual([song])
    expect(home.recommendations().netease).toMatchObject({ error: '网络异常', loading: false, loaded: false })
    await home.loadRecommendations('netease', true)
    flush()
    expect(home.recommendations().netease).toMatchObject({ error: null, loaded: true, items: [] })
    expect(home.recommendations().bili.items).toEqual([song])
  })

  it('重复挂载复用缓存，显式刷新才重新请求', async () => {
    await home.loadRecommendations('bili')
    flush()
    await home.loadRecommendations('bili')
    expect(bili).toHaveBeenCalledTimes(1)
    bili.mockResolvedValueOnce([{ ...song, id: '2' }])
    await home.loadRecommendations('bili', true)
    flush()
    expect(bili).toHaveBeenCalledTimes(2)
    expect(home.recommendations().bili.items[0]?.id).toBe('2')
  })

  it('同一音源的在途加载合并，避免刷新请求相互覆盖', async () => {
    let finish!: (songs: typeof song[]) => void
    bili.mockReturnValueOnce(new Promise(resolve => { finish = resolve }))
    const first = home.loadRecommendations('bili')
    const second = home.loadRecommendations('bili', true)
    expect(second).toBe(first)
    await Promise.resolve()
    flush()
    expect(home.recommendations().bili.loading).toBe(true)
    finish([song])
    await Promise.all([first, second])
    flush()
    expect(bili).toHaveBeenCalledTimes(1)
    expect(home.recommendations().bili).toMatchObject({ loading: false, loaded: true, items: [song] })
  })
})
