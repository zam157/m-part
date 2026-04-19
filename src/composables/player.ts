// #region types
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
  // Auto-play next song when current song ends
  if (currentIndex.value !== null && currentIndex.value < playlist.value.length - 1) {
    setCurrentIndex(currentIndex.value + 1, true)
  }
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
export function resetPlayer() {
  setSrc(null)
  currentIndex.value = null
  currentTime.value = 0
  duration.value = 0
  playing.value = false
  waiting.value = false
  seeking.value = false
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
export async function setCurrentIndex(index: number, autoplay?: boolean) {
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
  if (autoplay) {
    await setPlaying(true)
  }
}

/**
 * 播放上一首或下一首
 * @param type 0: prev, 1: next
 */
export function prevNext(type: 0 | 1) {
  if (!playlist.value.length)
    return
  const currentIndexVal = currentIndex.value ?? 0
  if (type === 0) {
    setCurrentIndex(Math.max(0, currentIndexVal - 1), true)
  }
  else if (type === 1) {
    setCurrentIndex(Math.min(playlist.value.length - 1, currentIndexVal + 1), true)
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
}

/**
 * 添加到播放列表
 */
export function addToPlaylist(item: PlayListItem) {
  playlist.value.push(item)
  triggerRef(playlist)
  setCurrentIndex(playlist.value.length - 1, true)
}

/**
 * 从播放列表中移除
 */
export function removeFromPlaylist(index: number) {
  playlist.value.splice(index, 1)
  triggerRef(playlist)
  if (playlist.value.length === 0) {
    resetPlayer()
  }
  else if (currentIndex.value !== null) {
    if (index < currentIndex.value) {
      currentIndex.value -= 1
    }
    else if (index === currentIndex.value) {
      // If the removed song is currently playing, play the next song
      setCurrentIndex(Math.min(currentIndex.value, playlist.value.length - 1), playing.value)
    }
  }
}

/**
 * 清空播放列表
 */
export function clearPlaylist() {
  playlist.value = []
  currentIndex.value = null
  resetPlayer()
}
// #endregion
