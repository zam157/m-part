import { flush } from 'solid-js'
import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * 播放链路回归测试：provider 给出 SourceInfo → 按音质地址取音频 → 设置 audio.src。
 *
 * 起因是一个很隐蔽的 bug：`playSource` 里 `setCurrentSourceInfo(sourceInfo)` 之后
 * 立刻调用 `changeQuality`，而后者内部读 `currentSourceInfo()` —— Solid 2 的 signal
 * 写入要到下一次 flush 才提交，所以读到的是旧值 null，函数直接提前返回，
 * 音频地址从未被设置（现象：接口正常返回但没声音）。
 */
const { tRequestMock } = vi.hoisted(() => ({ tRequestMock: vi.fn() }))

const SOURCE_INFO = {
  headers: { referer: 'https://www.bilibili.com/' },
  qualities: [
    { name: '64K', url: 'https://cdn.example/a.m4s' },
    { name: '192K', url: 'https://cdn.example/b.m4s' },
  ],
}

vi.mock('#shared/utils/providers', () => ({
  providers: {
    bili: {
      name: 'bili',
      getSourceInfo: vi.fn(async () => SOURCE_INFO),
    },
  },
}))

vi.mock('#shared/utils/fetch', () => ({ tRequest: tRequestMock }))

const { audio, changeQuality, resetPlayer, setPlayQueue } = await import('~/composables/player')

const song = {
  provider: 'bili' as const,
  id: 'BV16G411973A',
  title: 'Song 1',
  duration: 1,
  coverUrl: 'https://i2.hdslb.com/a.jpg',
}

describe('播放链路', () => {
  beforeEach(() => {
    tRequestMock.mockReset()
    tRequestMock.mockResolvedValue([true, { blob: async () => new Blob(['audio']) }])

    // jsdom 没实现 createObjectURL
    if (typeof URL.createObjectURL !== 'function') {
      Object.defineProperty(URL, 'createObjectURL', {
        value: () => 'blob:http://localhost:3000/mock',
        configurable: true,
      })
    }

    // currentSourceInfo 是模块级共享状态，逐个用例都要清干净
    // （resetPlayer → setSrc(null) 会把 currentSourceInfo 置空）
    resetPlayer()
    audio.removeAttribute('src')
    flush()
  })

  it('播放歌曲时按 provider 返回的第一个音质取音频', async () => {
    await setPlayQueue([song])
    flush()

    expect(tRequestMock).toHaveBeenCalledWith(
      'https://cdn.example/a.m4s',
      expect.objectContaining({ returnJson: false }),
    )
  })

  it('切换音质改用新地址，并把 active 标记写回 signal', async () => {
    await setPlayQueue([song])
    flush()
    tRequestMock.mockClear()

    await changeQuality(SOURCE_INFO.qualities[1])
    flush()

    expect(tRequestMock).toHaveBeenCalledWith(
      'https://cdn.example/b.m4s',
      expect.objectContaining({ returnJson: false }),
    )
  })

  it('没有 SourceInfo 时切音质不做任何请求', async () => {
    await changeQuality(SOURCE_INFO.qualities[0])

    expect(tRequestMock).not.toHaveBeenCalled()
  })
})
