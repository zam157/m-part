import { flush } from 'solid-js'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * 扩展播放链路：provider 给出 SourceInfo → 将音质 URL 交给原生 Audio 缓冲。
 *
 * 起因是一个很隐蔽的 bug：`playSource` 里 `setCurrentSourceInfo(sourceInfo)` 之后
 * 立刻调用 `changeQuality`，而后者内部读 `currentSourceInfo()` —— Solid 2 的 signal
 * 写入要到下一次 flush 才提交，所以读到的是旧值 null，函数直接提前返回，
 * 音频地址从未被设置（现象：接口正常返回但没声音）。
 */
const { tRequestMock, sourceInfoMock } = vi.hoisted(() => ({ tRequestMock: vi.fn(), sourceInfoMock: vi.fn() }))

vi.mock('#shared/utils/constants', () => ({ TARGET_EXTENSION: true }))

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
      getSourceInfo: sourceInfoMock,
    },
  },
}))

vi.mock('#shared/utils/fetch', () => ({ tRequest: tRequestMock }))

const { audio, changeQuality, currentSourceInfo, playbackError, resetPlayer, setPlayQueue, setPlaying, setSrc, waiting } = await import('~/composables/player')

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
    sourceInfoMock.mockReset().mockResolvedValue(SOURCE_INFO)
    // jsdom 不实现媒体加载；测试状态和 URL，实际缓冲在 Chrome 中验证。
    vi.spyOn(audio, 'pause').mockImplementation(() => {})
    vi.spyOn(audio, 'load').mockImplementation(() => {})
    vi.spyOn(audio, 'play').mockResolvedValue()
    vi.spyOn(console, 'error').mockImplementation(() => {})

    // currentSourceInfo 是模块级共享状态，逐个用例都要清干净
    // （resetPlayer → setSrc(null) 会把 currentSourceInfo 置空）
    resetPlayer()
    audio.removeAttribute('src')
    flush()
  })

  afterEach(() => vi.restoreAllMocks())

  it('直接使用第一个音质 URL，不通过 fetch 等待完整音频', async () => {
    await setPlayQueue([song])
    flush()

    expect(audio.src).toBe('https://cdn.example/a.m4s')
    expect(audio.preload).toBe('auto')
    expect(audio.crossOrigin).toBeNull()
    expect(tRequestMock).not.toHaveBeenCalled()
  })

  it('切换音质改用新地址，并把 active 标记写回 signal', async () => {
    await setPlayQueue([song])
    flush()
    tRequestMock.mockClear()

    await changeQuality(SOURCE_INFO.qualities[1])
    flush()

    expect(audio.src).toBe('https://cdn.example/b.m4s')
    expect(currentSourceInfo()?.qualities?.map(quality => quality.active)).toEqual([false, true])
    expect(tRequestMock).not.toHaveBeenCalled()
  })

  it('没有 SourceInfo 时切音质不做任何请求', async () => {
    await changeQuality(SOURCE_INFO.qualities[0])

    expect(tRequestMock).not.toHaveBeenCalled()
  })

  it('音源不可播放时保留原因并移除旧音频，重试成功后清除错误', async () => {
    sourceInfoMock.mockRejectedValueOnce(new Error('网易云暂未提供可播放音源'))
    audio.src = 'https://cdn.example/old.mp3'
    await setPlayQueue([song])
    flush()
    expect(playbackError()).toBe('网易云暂未提供可播放音源')
    expect(audio.hasAttribute('src')).toBe(false)
    expect(audio.pause).toHaveBeenCalled()
    expect(audio.play).not.toHaveBeenCalled()
    await setSrc(null, 'bili')
    flush()
    expect(playbackError()).toBeNull()
  })

  it('清空播放器会取消当前媒体源', async () => {
    await setPlayQueue([song])
    flush()
    vi.mocked(audio.pause).mockClear()
    vi.mocked(audio.load).mockClear()
    resetPlayer()
    flush()
    expect(audio.hasAttribute('src')).toBe(false)
    expect(audio.pause).toHaveBeenCalled()
    expect(audio.load).toHaveBeenCalled()
  })

  it('旧歌曲的迟到响应不能覆盖新歌曲的流地址', async () => {
    let finish!: (source: typeof SOURCE_INFO) => void
    sourceInfoMock.mockReturnValueOnce(new Promise(resolve => { finish = resolve }))
    const oldRequest = setPlayQueue([song])
    flush()
    await setPlayQueue([{ ...song, id: 'new-song' }])
    flush()
    finish({ ...SOURCE_INFO, qualities: [{ name: 'old', url: 'https://cdn.example/old.m4s' }] })
    await oldRequest
    flush()
    expect(audio.src).toBe('https://cdn.example/a.m4s')
    expect(playbackError()).toBeNull()
  })

  it('清空队列后迟到的音源响应不能重新加载音频', async () => {
    let finish!: (source: typeof SOURCE_INFO) => void
    sourceInfoMock.mockReturnValueOnce(new Promise(resolve => { finish = resolve }))
    const pending = setPlayQueue([song])
    flush()
    resetPlayer()
    flush()
    finish(SOURCE_INFO)
    await pending
    flush()
    expect(audio.hasAttribute('src')).toBe(false)
  })

  it('原生媒体加载错误会结束等待并显示原因', async () => {
    await setPlayQueue([song])
    flush()
    Object.defineProperty(audio, 'error', { configurable: true, value: { code: 2, message: 'CDN connection failed' } })
    try {
      audio.dispatchEvent(new Event('error'))
      flush()
      expect(playbackError()).toBe('CDN connection failed')
      expect(waiting()).toBe(false)
    }
    finally {
      Reflect.deleteProperty(audio, 'error')
    }
  })

  it('切歌造成的 play 中断不会被显示成播放故障', async () => {
    await setPlayQueue([song])
    flush()
    vi.mocked(audio.play).mockRejectedValueOnce(new DOMException('interrupted', 'AbortError'))
    await setPlaying(true)
    flush()
    expect(playbackError()).toBeNull()
  })
})
