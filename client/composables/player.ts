// #region types
export type PlayMode = 'order' | 'loop' | 'random'

export interface PlayListItem {
  name: string
  src?: string
  artist?: string
  album?: {
    name?: string
    cover?: string
  }
}
// #endregion

// #region states
export const audio = shallowRef(new Audio())
export const playing = shallowRef(false)
export const duration = shallowRef(0)
export const currentTime = shallowRef(0)
export const volume = shallowRef(1)
export const seeking = shallowRef(false)
export const waiting = shallowRef(false)
export const playlist = shallowRef<PlayListItem[]>([])
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
 * 设置播放地址
 */
export function setSrc(src: string | null) {
  if (src) {
    audio.value.src = src
  }
  else {
    audio.value.removeAttribute('src')
  }
  audio.value.load()
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
export function setCurrentIndex(index: number) {
  const song = playlist.value[index]
  if (!song) {
    const msg = `No song found at index ${index}.`
    console.warn(msg)
    return [false, msg] as const
  }
  currentIndex.value = index
  currentTime.value = 0
  duration.value = 0
  setSrc(song.src || null)
}

/**
 * 播放上一首或下一首
 * @param type 0: prev, 1: next
 */
export function prevNext(type: 0 | 1, autoPlay = true) {
  if (!playlist.value.length)
    return

  if (currentIndex.value === null || playlist.value.length <= 0)
    return

  // order
  if (playMode.value === 'order') {
    const nextIndex = type === 0 ? currentIndex.value - 1 : currentIndex.value + 1
    if (nextIndex < 0 || nextIndex >= playlist.value.length) {
      setPlaying(false)
      setCurrentIndex(0)
      return
    }
    setCurrentIndex(nextIndex)
    if (autoPlay)
      setPlaying(true)
  }
  // loop
  else if (playMode.value === 'loop') {
    const nextIndex = type === 0 ? currentIndex.value - 1 : currentIndex.value + 1
    setCurrentIndex((nextIndex + playlist.value.length) % playlist.value.length)
    if (autoPlay)
      setPlaying(true)
  }
  // random
  else if (playMode.value === 'random') {
    if (randomIndex.value === null) {
      setPlaying(false)
      return
    }

    let nextRandomIndex = type === 0 ? randomIndex.value - 1 : randomIndex.value + 1
    nextRandomIndex = (nextRandomIndex + randomPlaylist.value!.length) % randomPlaylist.value!.length
    setCurrentIndex(randomPlaylist.value![nextRandomIndex]!)
    if (autoPlay)
      setPlaying(true)
  }
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
export function setPlaylist(newPlaylist: PlayListItem[]) {
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
export function addToPlaylist(item: PlayListItem) {
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
  setCurrentIndex(playlist.value.length - 1)
  setPlaying(true)
}

/**
 * 从播放列表中移除
 */
export function removeFromPlaylist(index: number) {
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
    setCurrentIndex(currentIndex.value % playlist.value.length)
    setPlaying(playing.value)
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
