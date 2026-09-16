import type { MusicInfo, MusicQuality, SourceInfo } from '#shared/types/music-info'
import type { ProviderName } from '#shared/types/provider'
import { tRequest } from '#shared/utils/fetch'
import { providers } from '#shared/utils/providers'
import { createMemo, createRoot, createSignal } from 'solid-js'

// #region types
export type PlayMode = 'order' | 'loop' | 'random' | 'single-loop'
// #endregion

let abortController: AbortController | null = null

// #region states
/** 全局共享的 audio 元素 */
export const audio = new Audio()

const [playing, setPlayingState] = createSignal(false)
const [duration, setDuration] = createSignal(0)
const [currentTime, setCurrentTimeState] = createSignal(0)
const [volume, setVolumeState] = createSignal(1)
const [seeking, setSeekingState] = createSignal(false)
const [waiting, setWaiting] = createSignal(false)
const [currentIndex, setCurrentIndexState] = createSignal<number | null>(null)
const [showPlaylist, setShowPlaylist] = createSignal(false)
const [playMode, setPlayModeState] = createSignal<PlayMode>('order')
const [playlist, setPlaylistState] = createSignal<MusicInfo[]>([])
const [randomPlaylist, setRandomPlaylistState] = createSignal<number[] | null>(null)
const [currentSourceInfo, setCurrentSourceInfo] = createSignal<SourceInfo | null>(null)

export {
  currentIndex,
  currentSourceInfo,
  currentTime,
  duration,
  playlist,
  playing,
  playMode,
  randomPlaylist,
  seeking,
  setShowPlaylist,
  setWaiting,
  showPlaylist,
  volume,
  waiting,
}
// #endregion

// #region getters
/**
 * 派生状态统一放在 createRoot 内创建，避免 Solid 在开发模式下
 * 提示「computation created outside a createRoot will never be disposed」。
 * 这是模块级单例，生命周期与应用一致，root 永不 dispose。
 */
const { currentSong, progress, randomIndex } = createRoot(() => {
  /**
   * 当前进度（0-1）
   */
  const progress = createMemo(() => duration() === 0 ? 0 : currentTime() / duration())

  const currentSong = createMemo(() => {
    const index = currentIndex()
    if (index === null)
      return null
    return playlist()[index]
  })

  /** 当前歌曲在随机播放列表中的位置 */
  const randomIndex = createMemo(() => {
    const index = currentIndex()
    const random = randomPlaylist()
    if (index === null || !random?.length || !playlist().length || playMode() !== 'random')
      return null
    return random.findIndex(i => i === index)
  })

  return { currentSong, progress, randomIndex }
})

export { currentSong, progress, randomIndex }
// #endregion

// #region initialize listeners
audio.addEventListener('play', () => {
  setPlayingState(true)
})
audio.addEventListener('playing', () => {
  setWaiting(false)
  setPlayingState(true)
})
audio.addEventListener('pause', () => {
  setPlayingState(false)
})
audio.addEventListener('durationchange', () => {
  setDuration(audio.duration)
})
audio.addEventListener('waiting', () => {
  setWaiting(true)
})
audio.addEventListener('loadstart', () => {
  setWaiting(true)
})
audio.addEventListener('loadeddata', () => {
  setWaiting(false)
})
audio.addEventListener('timeupdate', () => {
  setCurrentTimeState(audio.currentTime)
})
audio.addEventListener('seeking', () => {
  setSeekingState(true)
})
audio.addEventListener('seeked', () => {
  setSeekingState(false)
})
audio.addEventListener('volumechange', () => {
  setVolumeState(audio.volume)
})
audio.addEventListener('ended', () => {
  if (playMode() === 'single-loop') {
    // 单曲循环：重新播放当前歌曲
    setCurrentTime(0)
    setPlaying(true)
    return
  }
  if (playMode() === 'order') {
    // 顺序播放：如果是最后一首，停止播放
    if (currentIndex() === playlist().length - 1) {
      setPlaying(false)
      prevNext(1, false)
      return
    }
  }
  prevNext(1)
})
audio.addEventListener('error', (e) => {
  console.error('Audio error:', e)
  setWaiting(false)
  setPlayingState(false)
})
// #endregion

// #region actions
/**
 * 生成随机播放顺序（Fisher-Yates 洗牌算法）。
 *
 * 注意：Solid 2 的 signal 写入会在下一次 flush 才提交，写入后立刻读取拿到的是
 * 提交前的值。因此这里做成不读取响应式状态的纯函数，由调用方把长度传进来。
 */
function createRandomOrder(length: number): number[] | null {
  if (length === 0)
    return null
  const indices = Array.from({ length }, (_, i) => i)
  for (let i = indices.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[indices[i], indices[j]] = [indices[j]!, indices[i]!]
  }
  return indices
}

export function resetPlayer() {
  setSrc(null)
  setCurrentIndexState(null)
  setCurrentTimeState(0)
  setDuration(0)
  setPlayingState(false)
  setWaiting(false)
  setSeekingState(false)
  setRandomPlaylistState(null)
}

/**
 * 改变音质
 */
export async function changeQuality(quality?: MusicQuality) {
  const sourceInfo = currentSourceInfo()
  if (!sourceInfo)
    return
  const { qualities, headers, url } = sourceInfo

  const targetUrl = quality?.url || url
  if (quality && qualities) {
    // 用不可变更新替换就地改写 qualities[].active，保证 Solid 能感知变化
    setCurrentSourceInfo({
      ...sourceInfo,
      qualities: qualities.map(q => ({ ...q, active: q.name === quality.name })),
    })
  }

  if (!abortController)
    abortController = new AbortController()
  if (!targetUrl)
    throw new Error('No valid URL found in qualities.')
  const res = await tRequest(targetUrl, { headers, returnJson: false, signal: abortController.signal })
  if (!res[0])
    throw new Error(`Failed to fetch source URL: ${res[2]}`)

  const blob = await res[1].blob()
  const objectUrl = URL.createObjectURL(blob)
  audio.src = objectUrl
  audio.load()
}

/**
 * 设置播放地址的内部实现。
 *
 * `music` 由调用方显式传入：Solid 2 的 signal 写入要到下一次 flush 才提交，
 * 若在这里读取 `currentSong()`，刚由 `startPlaying` 写入的 `currentIndex`
 * 还不可见，会拿到上一首歌（或 null）。
 */
async function playSource(music: MusicInfo | undefined, src: string | null, provider?: ProviderName) {
  setCurrentSourceInfo(null)
  if (abortController) {
    abortController.abort()
    abortController = null
  }
  if (src) {
    audio.src = src
    audio.load()
    return
  }
  if (provider) {
    // 使用 provider 提供的 getSourceInfo 方法获取带有必要 headers 的播放地址
    // 以便在需要跨域请求时能够正常播放
    const providerInstance = providers[provider]
    if (providerInstance?.getSourceInfo && music) {
      try {
        setWaiting(true)
        const sourceInfo = await providerInstance.getSourceInfo(music)
        setCurrentSourceInfo(sourceInfo)
        // TODO: 记住上次使用的音质，优先选择上次使用的音质, 目前先默认选择第一个音质
        const defaultQuality = sourceInfo.qualities?.[0]
        await changeQuality(defaultQuality)
      }
      catch (error) {
        console.error(`Error fetching source info from provider ${provider}:`, error)
        setWaiting(false)
      }
      finally {
        abortController = null
      }
      return
    }

    console.warn(`Provider ${provider} does not support getSourceInfo or current song is null.`)
  }

  audio.removeAttribute('src')
}

/**
 * 设置播放地址（以当前播放的歌曲为准）
 */
export async function setSrc(src: string | null, provider?: ProviderName) {
  await playSource(currentSong() ?? undefined, src, provider)
}
/**
 * 设置播放状态
 */
export async function setPlaying(isPlaying: boolean) {
  if (isPlaying) {
    try {
      await audio.play()
    }
    catch (err) {
      console.error('Failed to play audio:', err)
      setPlayingState(false)
      setSeekingState(false)
      setWaiting(false)
      audio.pause()
    }
  }
  else {
    audio.pause()
  }
}
/**
 * 切换到指定歌曲。
 *
 * `music` 由调用方显式传入（而不是内部读取 `playlist()`），这样在同一个同步块里
 * 刚写入过播放列表的调用方也能正确取到歌曲 —— Solid 2 的 signal 写入要到下一次
 * flush 才提交，写入后立刻读取会拿到旧列表。
 */
async function startPlaying(music: MusicInfo | undefined, index: number) {
  setCurrentIndexState(index)
  setCurrentTimeState(0)
  setDuration(0)
  await playSource(music, music?.src || null, music?.provider)
}

/**
 * 设置当前播放的歌曲
 */
export async function setCurrentIndex(index: number) {
  await startPlaying(playlist()[index], index)
}

/**
 * 播放上一首或下一首
 * @param type 0: prev, 1: next
 * @param autoPlay 是否自动播放下一首，默认为 true
 */
export async function prevNext(type: 0 | 1, autoPlay = true) {
  const list = playlist()
  if (!list.length)
    return

  const current = currentIndex()
  if (current === null || list.length <= 0)
    return

  const mode = playMode()
  // order
  if (mode === 'order') {
    const nextIndex = type === 0 ? current - 1 : current + 1
    if (nextIndex < 0) {
      await setCurrentIndex(list.length - 1)
    }
    else if (nextIndex >= list.length) {
      await setPlaying(false)
      await setCurrentIndex(0)
    }
    else {
      await setCurrentIndex(nextIndex)
    }
  }
  // loop
  else if (mode === 'loop') {
    const nextIndex = type === 0 ? current - 1 : current + 1
    await setCurrentIndex((nextIndex + list.length) % list.length)
  }
  // single-loop
  else if (mode === 'single-loop') {
    const nextIndex = type === 0 ? current - 1 : current + 1
    await setCurrentIndex((nextIndex + list.length) % list.length)
  }
  // random
  else if (mode === 'random') {
    const random = randomPlaylist()
    const position = randomIndex()
    if (position === null || !random) {
      await setPlaying(false)
      return
    }

    let nextRandomIndex = type === 0 ? position - 1 : position + 1
    nextRandomIndex = (nextRandomIndex + random.length) % random.length
    await setCurrentIndex(random[nextRandomIndex]!)
  }
  if (autoPlay)
    await setPlaying(true)
}

/**
 * 设置当前时间
 */
export function setCurrentTime(time: number) {
  setCurrentTimeState(time)
  audio.currentTime = time
}

/**
 * 设置音量
 */
export function setVolume(vol: number) {
  audio.volume = vol
}

/**
 * 覆盖播放列表
 */
export async function setPlaylist(newPlaylist: MusicInfo[]) {
  resetPlayer()
  setPlaylistState(newPlaylist)
  if (playMode() === 'random') {
    const random = createRandomOrder(newPlaylist.length)
    setRandomPlaylistState(random)
    setCurrentIndexState(random?.[0] ?? null)
  }
  await startPlaying(newPlaylist[0], 0)
  await setPlaying(newPlaylist.length > 0)
}

/**
 * 添加到播放列表
 */
export async function addToPlaylist(item: MusicInfo) {
  // 避免重复添加同一首歌
  const list = playlist()
  const existingIndex = list.findIndex(m => m.provider === item.provider && m.id === item.id)
  if (existingIndex !== -1) {
    await setCurrentIndex(existingIndex)
    await setPlaying(true)
    return
  }

  setPlaylistState([...list, item])
  if (playMode() === 'random') {
    const random = randomPlaylist() ?? []
    // 随机插入新歌曲在随机列表中的位置
    const insertPos = Math.floor(Math.random() * (random.length + 1))
    setRandomPlaylistState([
      ...random.slice(0, insertPos),
      list.length,
      ...random.slice(insertPos),
    ])
  }
  await startPlaying(item, list.length)
  await setPlaying(true)
}

/**
 * 从播放列表中移除
 */
export async function removeFromPlaylist(index: number) {
  const list = playlist().filter((_, i) => i !== index)
  setPlaylistState(list)
  const random = randomPlaylist()
  if (playMode() === 'random' && random) {
    // 与原先的 splice(findIndex(...), 1) 保持一致（含找不到时的 -1 行为）
    const position = random.findIndex(i => i === index)
    setRandomPlaylistState(
      random
        .filter((_, i) => i !== position)
        // 调整随机列表中大于被删除索引的值
        .map(i => i > index ? i - 1 : i),
    )
  }

  const current = currentIndex()

  if (list.length === 0 || current === null) {
    setShowPlaylist(false)
    resetPlayer()
    return
  }

  if (current > index) {
    setCurrentIndexState(current - 1)
  }
  else if (current === index) {
    const nextIndex = current % list.length
    await startPlaying(list[nextIndex], nextIndex)
    await setPlaying(playing())
  }
}

export function setPlayMode(mode: PlayMode) {
  setPlayModeState(mode)
  if (mode === 'random') {
    setRandomPlaylistState(createRandomOrder(playlist().length))
  }
  else {
    setRandomPlaylistState(null)
  }
}

/**
 * 切换播放模式
 */
export function togglePlayMode() {
  switch (playMode()) {
    case 'order':
      setPlayMode('loop')
      break
    case 'loop':
      setPlayMode('random')
      break
    case 'random':
      setPlayMode('single-loop')
      break
    case 'single-loop':
      setPlayMode('order')
      break
  }
}

/**
 * 清空播放列表
 */
export function clearPlaylist() {
  setPlaylist([])
}
// #endregion
