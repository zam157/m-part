import type { MusicInfo, MusicQuality, SourceInfo } from '#shared/types/music-info'
import type { ProviderName } from '#shared/types/provider'
import { tRequest } from '#shared/utils/fetch'
import { providers } from '#shared/utils/providers'

let abortController: AbortController | null = null

// #region types
export type PlayMode = 'order' | 'loop' | 'random' | 'single-loop'
// #endregion

// #region states
export const audio = shallowRef(new Audio())
export const currentSourceInfo = ref<SourceInfo | null>(null)
export const playing = shallowRef(false)
export const duration = shallowRef(0)
export const currentTime = shallowRef(0)
export const volume = shallowRef(1)
export const seeking = shallowRef(false)
export const waiting = shallowRef(false)
export const playlist = shallowRef<MusicInfo[]>([])
export const currentIndex = shallowRef<number | null>(null)
export const showPlaylist = shallowRef(false)
export const playMode = shallowRef<PlayMode>('order')
/** 随机播放列表, 存储播放列表中真实的key值 */
export const randomPlaylist = shallowRef<number[] | null>(null)
export const randomIndex = computed(() => {
  if (currentIndex.value === null || !randomPlaylist.value?.length || !playlist.value.length || playMode.value !== 'random')
    return null
  return randomPlaylist.value.findIndex(i => i === currentIndex.value)
})
// #endregion

// #region initialize listeners
audio.value.addEventListener('play', () => {
  playing.value = true
})
audio.value.addEventListener('playing', () => {
  waiting.value = false
  playing.value = true
})
audio.value.addEventListener('pause', () => {
  playing.value = false
})
audio.value.addEventListener('durationchange', () => {
  duration.value = audio.value.duration
})
audio.value.addEventListener('waiting', () => {
  waiting.value = true
})
audio.value.addEventListener('loadstart', () => {
  waiting.value = true
})
audio.value.addEventListener('loadeddata', () => {
  waiting.value = false
})
audio.value.addEventListener('timeupdate', () => {
  currentTime.value = audio.value.currentTime
})
audio.value.addEventListener('seeking', () => {
  seeking.value = true
})
audio.value.addEventListener('seeked', () => {
  seeking.value = false
})
audio.value.addEventListener('volumechange', () => {
  volume.value = audio.value.volume
})
audio.value.addEventListener('ended', () => {
  if (playMode.value === 'single-loop') {
    // 单曲循环：重新播放当前歌曲
    setCurrentTime(0)
    setPlaying(true)
    return
  }
  if (playMode.value === 'order') {
    // 顺序播放：如果是最后一首，停止播放
    if (currentIndex.value === playlist.value.length - 1) {
      setPlaying(false)
      prevNext(1, false)
      return
    }
  }
  prevNext(1)
})
audio.value.addEventListener('error', (e) => {
  console.error('Audio error:', e)
  waiting.value = false
  playing.value = false
})
// #endregion

// #region getters
/**
 * 当前进度（0-1）
 */
export const progress = computed(() => duration.value === 0 ? 0 : currentTime.value / duration.value)
export const currentSong = computed(() => {
  if (currentIndex.value === null)
    return null
  return playlist.value[currentIndex.value]
})
// #endregion

// #region actions
/**
 * 生成随机播放列表（Fisher-Yates 洗牌算法）
 */
function generateRandomPlaylist() {
  if (playlist.value.length === 0) {
    randomPlaylist.value = null
    return
  }
  const indices = Array.from({ length: playlist.value.length }, (_, i) => i)
  for (let i = indices.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[indices[i], indices[j]] = [indices[j]!, indices[i]!]
  }
  randomPlaylist.value = indices
}

export function resetPlayer() {
  setSrc(null)
  currentIndex.value = null
  currentTime.value = 0
  duration.value = 0
  playing.value = false
  waiting.value = false
  seeking.value = false
  randomPlaylist.value = null
}

/**
 * 改变音质
 */
export async function changeQuality(quality?: MusicQuality) {
  if (!currentSourceInfo.value)
    return
  const { qualities, headers, url } = currentSourceInfo.value

  const targetUrl = quality?.url || url
  if (quality && qualities) {
    for (const q of qualities) {
      q.active = q.name === quality.name
    }
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
  audio.value.src = objectUrl
  audio.value.load()
}

/**
 * 设置播放地址
 */
export async function setSrc(src: string | null, provider?: ProviderName) {
  currentSourceInfo.value = null
  if (abortController) {
    abortController.abort()
    abortController = null
  }
  if (src) {
    audio.value.src = src
    audio.value.load()
    return
  }
  if (provider) {
    // 使用 provider 提供的 getSourceInfo 方法获取带有必要 headers 的播放地址
    // 以便在需要跨域请求时能够正常播放
    const providerInstance = providers[provider]
    if (providerInstance?.getSourceInfo && currentSong.value) {
      try {
        waiting.value = true
        currentSourceInfo.value = await providerInstance.getSourceInfo(currentSong.value)
        // TODO: 记住上次使用的音质，优先选择上次使用的音质, 目前先默认选择第一个音质
        const defaultQuality = currentSourceInfo.value.qualities?.[0]
        await changeQuality(defaultQuality)
      }
      catch (error) {
        console.error(`Error fetching source info from provider ${provider}:`, error)
        waiting.value = false
      }
      finally {
        abortController = null
      }
      return
    }

    console.warn(`Provider ${provider} does not support getSourceInfo or current song is null.`)
  }

  audio.value.removeAttribute('src')
}
/**
 * 设置播放状态
 */
export async function setPlaying(isPlaying: boolean) {
  if (isPlaying) {
    try {
      await audio.value.play()
    }
    catch (err) {
      console.error('Failed to play audio:', err)
      playing.value = false
      seeking.value = false
      waiting.value = false
      audio.value.pause()
    }
  }
  else {
    audio.value.pause()
  }
}
/**
 * 设置当前播放的歌曲
 */
export async function setCurrentIndex(index: number) {
  const music = playlist.value[index]
  if (!music) {
    const msg = `No song found at index ${index}.`
    console.warn(msg)
    return [false, msg] as const
  }
  currentIndex.value = index
  currentTime.value = 0
  duration.value = 0
  await setSrc(music.src || null, music.provider)
}

/**
 * 播放上一首或下一首
 * @param type 0: prev, 1: next
 * @param autoPlay 是否自动播放下一首，默认为 true
 */
export async function prevNext(type: 0 | 1, autoPlay = true) {
  if (!playlist.value.length)
    return

  if (currentIndex.value === null || playlist.value.length <= 0)
    return

  // order
  if (playMode.value === 'order') {
    const nextIndex = type === 0 ? currentIndex.value - 1 : currentIndex.value + 1
    if (nextIndex < 0) {
      await setCurrentIndex(playlist.value.length - 1)
    }
    else if (nextIndex >= playlist.value.length) {
      await setPlaying(false)
      await setCurrentIndex(0)
    }
    else {
      await setCurrentIndex(nextIndex)
    }
  }
  // loop
  else if (playMode.value === 'loop') {
    const nextIndex = type === 0 ? currentIndex.value - 1 : currentIndex.value + 1
    await setCurrentIndex((nextIndex + playlist.value.length) % playlist.value.length)
  }
  // single-loop
  else if (playMode.value === 'single-loop') {
    const nextIndex = type === 0 ? currentIndex.value - 1 : currentIndex.value + 1
    await setCurrentIndex((nextIndex + playlist.value.length) % playlist.value.length)
  }
  // random
  else if (playMode.value === 'random') {
    if (randomIndex.value === null) {
      await setPlaying(false)
      return
    }

    let nextRandomIndex = type === 0 ? randomIndex.value - 1 : randomIndex.value + 1
    nextRandomIndex = (nextRandomIndex + randomPlaylist.value!.length) % randomPlaylist.value!.length
    await setCurrentIndex(randomPlaylist.value![nextRandomIndex]!)
  }
  if (autoPlay)
    await setPlaying(true)
}

/**
 * 设置当前时间
 */
export function setCurrentTime(time: number) {
  currentTime.value = time
  audio.value.currentTime = time
}

/**
 * 设置音量
 */
export function setVolume(vol: number) {
  audio.value.volume = vol
}

/**
 * 覆盖播放列表
 */
export function setPlaylist(newPlaylist: MusicInfo[]) {
  resetPlayer()
  playlist.value = newPlaylist
  if (playMode.value === 'random') {
    generateRandomPlaylist()
    currentIndex.value = randomPlaylist.value?.[0] ?? null
  }
}

/**
 * 添加到播放列表
 */
export async function addToPlaylist(item: MusicInfo) {
  // 避免重复添加同一首歌
  const existingIndex = playlist.value.findIndex(m => m.provider === item.provider && m.id === item.id)
  if (existingIndex !== -1) {
    await setCurrentIndex(existingIndex)
    await setPlaying(true)
    return
  }

  playlist.value.push(item)
  triggerRef(playlist)
  if (playMode.value === 'random') {
    if (!randomPlaylist.value)
      randomPlaylist.value = []
    // 随机插入新歌曲在随机列表中的位置
    const insertPos = Math.floor(Math.random() * (randomPlaylist.value.length + 1))
    randomPlaylist.value.splice(insertPos, 0, playlist.value.length - 1)
    triggerRef(randomPlaylist)
  }
  await setCurrentIndex(playlist.value.length - 1)
  await setPlaying(true)
}

/**
 * 从播放列表中移除
 */
export async function removeFromPlaylist(index: number) {
  playlist.value.splice(index, 1)
  triggerRef(playlist)
  if (playMode.value === 'random' && randomPlaylist.value) {
    randomPlaylist.value.splice(randomPlaylist.value.findIndex(i => i === index), 1)
    // 调整随机列表中大于被删除索引的值
    randomPlaylist.value = randomPlaylist.value.map(i => i > index ? i - 1 : i)
    triggerRef(randomPlaylist)
  }

  if (playlist.value.length === 0 || currentIndex.value === null) {
    showPlaylist.value = false
    resetPlayer()
    return
  }

  if (currentIndex.value > index) {
    currentIndex.value -= 1
  }
  else if (currentIndex.value === index) {
    await setCurrentIndex(currentIndex.value % playlist.value.length)
    await setPlaying(playing.value)
  }
}

export function setPlayMode(mode: PlayMode) {
  playMode.value = mode
  if (mode === 'random') {
    generateRandomPlaylist()
  }
  else {
    randomPlaylist.value = null
  }
}

/**
 * 切换播放模式
 */
export function togglePlayMode() {
  switch (playMode.value) {
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
