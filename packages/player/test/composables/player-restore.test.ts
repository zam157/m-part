import { flush } from 'solid-js'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { PlayerCache } from '~/utils/player-storage'

const { source } = vi.hoisted(() => ({ source: vi.fn() }))
vi.mock('@m-part/music/constants', () => ({ TARGET_EXTENSION: true }))
vi.mock('@m-part/music/providers', () => ({ providers: { netease: { getSourceInfo: source } } }))
const player = await import('~/composables/player')
const song = { provider: 'netease' as const, id: '1', title: '歌曲', duration: 120, coverUrl: '' }
const cache: PlayerCache = {
  queue: { items: [song, { ...song, id: '2' }], playMode: 'random', randomOrder: [1, 0] },
  position: { song: { provider: 'netease', id: '2' }, time: 45 }, volume: 0.35,
}
beforeEach(async () => {
  vi.spyOn(player.audio, 'pause').mockImplementation(() => {})
  vi.spyOn(player.audio, 'load').mockImplementation(() => {})
  vi.spyOn(player.audio, 'play').mockResolvedValue()
  source.mockReset().mockResolvedValue({ url: 'https://cdn.example/new.mp3' })
  await player.setPlayQueue([])
  Object.defineProperty(player.audio, 'readyState', { configurable: true, value: 0 })
  Object.defineProperty(player.audio, 'duration', { configurable: true, value: 100 })
  flush()
})
afterEach(() => {
  Reflect.deleteProperty(player.audio, 'readyState')
  Reflect.deleteProperty(player.audio, 'duration')
  vi.restoreAllMocks()
})

describe('恢复播放器会话', () => {
  it('恢复队列、当前曲目、模式、随机顺序、音量与进度，不请求音频或自动播放', () => {
    vi.mocked(player.audio.play).mockClear()
    player.restorePlayerSession(cache)
    flush()
    expect(player.currentIndex()).toBe(1)
    expect(player.currentSong()?.id).toBe('2')
    expect(player.currentTime()).toBe(45)
    expect(player.duration()).toBe(120)
    expect(player.volume()).toBe(0.35)
    expect(player.audio.volume).toBe(0.35)
    expect(player.playMode()).toBe('random')
    expect(player.randomPlayQueue()).toEqual([1, 0])
    expect(player.playing()).toBe(false)
    expect(source).not.toHaveBeenCalled()
    expect(player.audio.play).not.toHaveBeenCalled()
  })

  it('首次恢复播放时取得新音频 URL，忽略加载期归零事件，元数据就绪后续播', async () => {
    player.restorePlayerSession(cache)
    flush()
    await player.setPlaying(true)
    flush()
    expect(source).toHaveBeenCalledWith(expect.objectContaining({ id: '2' }))
    expect(player.audio.src).toBe('https://cdn.example/new.mp3')
    player.audio.currentTime = 0
    player.audio.dispatchEvent(new Event('timeupdate'))
    flush()
    expect(player.currentTime()).toBe(45)
    player.audio.dispatchEvent(new Event('loadedmetadata'))
    flush()
    expect(player.audio.currentTime).toBe(45)
    expect(player.audio.play).toHaveBeenCalled()
  })

  it('恢复后可以先调整进度，超出音频实际时长时限制在有效范围', async () => {
    player.restorePlayerSession(cache)
    flush()
    player.setCurrentTime(115)
    flush()
    await player.setPlaying(true)
    player.audio.dispatchEvent(new Event('loadedmetadata'))
    flush()
    expect(player.audio.currentTime).toBeCloseTo(99.95)
  })

  it('恢复音源请求期间暂停，迟到响应不会自动播放；正常换歌清除恢复位置', async () => {
    let finish!: (value: { url: string }) => void
    source.mockReturnValueOnce(new Promise(resolve => { finish = resolve }))
    player.restorePlayerSession(cache)
    flush()
    vi.mocked(player.audio.play).mockClear()
    const resume = player.setPlaying(true)
    await player.setPlaying(false)
    finish({ url: 'https://cdn.example/new.mp3' })
    await resume
    expect(player.audio.play).not.toHaveBeenCalled()
    await player.setCurrentIndex(0)
    player.audio.currentTime = 0
    player.audio.dispatchEvent(new Event('loadedmetadata'))
    flush()
    expect(player.currentTime()).toBe(0)
  })
})
