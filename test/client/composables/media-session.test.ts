import { flush } from 'solid-js'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { startMediaSession } from '~/composables/media-session'
import { audio, clearPlayQueue, currentSong, currentTime, restorePlayerSession, setPlayMode, setPlayQueue } from '~/composables/player'

vi.mock('#shared/utils/providers', () => ({ providers: {} }))
const songs = [
  { provider: 'bili' as const, id: '1', title: '第一首', artist: '歌手', album: '专辑', duration: 120, coverUrl: '//i1.hdslb.com/cover.jpg', src: 'https://cdn.example/1.mp3' },
  { provider: 'qq' as const, id: '2', title: '第二首', duration: 180, coverUrl: '', src: 'https://cdn.example/2.mp3' },
]
const handlers = new Map<MediaSessionAction, MediaSessionActionHandler | null>()
const session = {
  metadata: null as MediaMetadata | null,
  playbackState: 'none' as MediaSessionPlaybackState,
  setActionHandler: vi.fn((action: MediaSessionAction, handler: MediaSessionActionHandler | null) => { handlers.set(action, handler) }),
  setPositionState: vi.fn(),
}
let dispose: (() => void) | undefined
let paused = true
let duration = Number.NaN
let readyState = 0

beforeEach(async () => {
  handlers.clear()
  vi.clearAllMocks()
  session.setActionHandler.mockReset().mockImplementation((name, handler) => { handlers.set(name, handler) })
  vi.stubGlobal('navigator', { mediaSession: session })
  vi.stubGlobal('MediaMetadata', class {
    constructor(init: MediaMetadataInit) { Object.assign(this, init) }
  })
  paused = true
  duration = Number.NaN
  readyState = 0
  vi.spyOn(audio, 'paused', 'get').mockImplementation(() => paused)
  vi.spyOn(audio, 'duration', 'get').mockImplementation(() => duration)
  vi.spyOn(audio, 'readyState', 'get').mockImplementation(() => readyState)
  vi.spyOn(audio, 'play').mockImplementation(async () => {
    paused = false
    audio.dispatchEvent(new Event('play'))
  })
  vi.spyOn(audio, 'pause').mockImplementation(() => {
    paused = true
    audio.dispatchEvent(new Event('pause'))
  })
  vi.spyOn(audio, 'load').mockImplementation(() => {
    duration = Number.NaN
    readyState = 0
    audio.currentTime = 0
    audio.dispatchEvent(new Event('emptied'))
  })
  await clearPlayQueue()
  setPlayMode('order')
  audio.playbackRate = 1
  flush()
})

afterEach(() => {
  dispose?.()
  dispose = undefined
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

async function mount() {
  dispose = startMediaSession()
  await setPlayQueue(songs)
  flush()
}

function loadMetadata() {
  duration = 120
  readyState = 1
  audio.dispatchEvent(new Event('loadedmetadata'))
  flush()
}

async function action(name: MediaSessionAction, details: Partial<MediaSessionActionDetails> = {}) {
  expect(handlers.get(name)).toBeTypeOf('function')
  handlers.get(name)!({ action: name, ...details })
  // 系统回调不等待 Promise；播放器切源和 Solid 提交各有异步阶段。
  await new Promise(resolve => setTimeout(resolve, 0))
  flush()
}

describe('系统媒体会话', () => {
  it('空队列不提供控制；选歌同步标题、歌手、专辑和 HTTPS 封面', async () => {
    dispose = startMediaSession()
    flush()
    expect(session.metadata).toBeNull()
    expect(session.playbackState).toBe('none')
    expect(handlers.get('play')).toBeNull()
    await setPlayQueue(songs)
    flush()
    expect(session.metadata).toMatchObject({ title: '第一首', artist: '歌手', album: '专辑', artwork: [{ src: 'https://i1.hdslb.com/cover.jpg' }] })
    expect(session.playbackState).toBe('playing')
  })

  it('系统播放、暂停和上下首操作实际控制共享播放器，切歌清除旧封面和进度', async () => {
    await mount()
    loadMetadata()
    await action('pause')
    expect(audio.pause).toHaveBeenCalled()
    expect(session.playbackState).toBe('paused')
    await action('play')
    expect(session.playbackState).toBe('playing')
    await action('nexttrack')
    expect(currentSong()?.id).toBe('2')
    expect(session.metadata).toMatchObject({ title: '第二首', artist: '', album: '', artwork: [] })
    expect(session.setPositionState).toHaveBeenLastCalledWith()
    await action('previoustrack')
    expect(currentSong()?.id).toBe('1')
  })

  it('系统切歌遵循现有单曲循环模式的手动切歌规则', async () => {
    await mount()
    setPlayMode('single-loop')
    flush()
    await action('nexttrack')
    expect(currentSong()?.id).toBe('2')
  })

  it('元数据就绪后发布真实进度和速率，跳转及快进快退限制在有效范围', async () => {
    await mount()
    loadMetadata()
    audio.currentTime = 45
    audio.playbackRate = 1.5
    audio.dispatchEvent(new Event('timeupdate'))
    expect(session.setPositionState).toHaveBeenLastCalledWith({ duration: 120, position: 45, playbackRate: 1.5 })
    await action('seekto', { seekTime: 60 })
    expect(audio.currentTime).toBe(60)
    expect(currentTime()).toBe(60)
    await action('seekforward')
    expect(audio.currentTime).toBe(70)
    await action('seekbackward', { seekOffset: 15 })
    expect(audio.currentTime).toBe(55)
    await action('seekto', { seekTime: 999 })
    expect(audio.currentTime).toBe(120)
    await action('seekbackward', { seekOffset: 999 })
    expect(audio.currentTime).toBe(0)
    await action('seekto', { seekTime: Number.NaN })
    expect(audio.currentTime).toBe(0)
  })

  it('停止操作暂停并归零；清空队列移除系统信息及全部控制', async () => {
    await mount()
    loadMetadata()
    audio.currentTime = 40
    await action('stop')
    expect(audio.currentTime).toBe(0)
    expect(session.playbackState).toBe('paused')
    expect(currentSong()?.id).toBe('1')
    await clearPlayQueue()
    flush()
    expect(session.metadata).toBeNull()
    expect(session.playbackState).toBe('none')
    expect(session.setPositionState).toHaveBeenLastCalledWith()
    expect([...handlers.values()].every(handler => handler === null)).toBe(true)
  })

  it('未知或无穷时长不发布非法位置，也不执行跳转', async () => {
    await mount()
    await action('seekto', { seekTime: 20 })
    expect(audio.currentTime).toBe(0)
    readyState = 1
    for (const value of [Number.NaN, Number.POSITIVE_INFINITY, 0, -1]) {
      duration = value
      audio.dispatchEvent(new Event('durationchange'))
      expect(session.setPositionState).toHaveBeenLastCalledWith()
    }
  })

  it('真实暂停、播放速率及音频错误事件及时更新系统状态', async () => {
    await mount()
    loadMetadata()
    audio.currentTime = 42
    audio.pause()
    expect(session.playbackState).toBe('paused')
    expect(session.setPositionState).toHaveBeenLastCalledWith({ duration: 120, position: 42, playbackRate: 1 })
    audio.playbackRate = 2
    audio.dispatchEvent(new Event('ratechange'))
    expect(session.setPositionState).toHaveBeenLastCalledWith({ duration: 120, position: 42, playbackRate: 2 })
    await action('play')
    vi.spyOn(console, 'error').mockImplementation(() => {})
    Object.defineProperty(audio, 'error', { configurable: true, value: { code: 2, message: '离线' } })
    try {
      audio.dispatchEvent(new Event('error'))
      expect(session.playbackState).toBe('paused')
    }
    finally {
      Reflect.deleteProperty(audio, 'error')
    }
  })

  it('恢复缓存时展示暂停的歌曲资料，系统播放才加载音频', async () => {
    dispose = startMediaSession()
    restorePlayerSession({ queue: { items: songs, playMode: 'order', randomOrder: null }, position: { song: songs[0]!, time: 35 } })
    flush()
    expect(session.metadata?.title).toBe('第一首')
    expect(session.playbackState).toBe('paused')
    expect(audio.getAttribute('src')).toBeNull()
    expect(audio.play).not.toHaveBeenCalled()
    await action('play')
    expect(audio.getAttribute('src')).toBe(songs[0]!.src)
    expect(session.playbackState).toBe('playing')
  })

  it('缺失 API 安全降级，单项控制不支持时其他操作仍可用', async () => {
    vi.stubGlobal('navigator', {})
    expect(() => startMediaSession()()).not.toThrow()
    vi.stubGlobal('navigator', { mediaSession: session })
    session.setActionHandler.mockImplementation((name, handler) => {
      if (name === 'seekto')
        throw new DOMException('Unsupported', 'NotSupportedError')
      handlers.set(name, handler)
    })
    await mount()
    expect(handlers.get('play')).toBeTypeOf('function')
    await action('pause')
    expect(session.playbackState).toBe('paused')
  })

  it('缺少位置和元数据 API 时仍支持播放控制', async () => {
    vi.stubGlobal('navigator', { mediaSession: { setActionHandler: session.setActionHandler, playbackState: 'none' } })
    vi.stubGlobal('MediaMetadata', undefined)
    await mount()
    await action('pause')
    expect(audio.paused).toBe(true)
  })

  it('回前台重新同步进度，销毁后解绑事件、响应式更新和系统操作', async () => {
    await mount()
    loadMetadata()
    audio.currentTime = 30
    document.dispatchEvent(new Event('visibilitychange'))
    expect(session.setPositionState).toHaveBeenLastCalledWith({ duration: 120, position: 30, playbackRate: 1 })
    dispose!()
    dispose = undefined
    session.setPositionState.mockClear()
    session.setActionHandler.mockClear()
    await setPlayQueue([songs[1]!])
    flush()
    audio.dispatchEvent(new Event('timeupdate'))
    window.dispatchEvent(new Event('pageshow'))
    expect(session.metadata).toBeNull()
    expect(session.playbackState).toBe('none')
    expect(session.setPositionState).not.toHaveBeenCalled()
    expect(session.setActionHandler).not.toHaveBeenCalled()
  })
})
