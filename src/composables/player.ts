// #region states
export const audio = shallowRef(new Audio())
export const playing = shallowRef(false)
export const duration = shallowRef(0)
export const currentTime = shallowRef(0)
export const volume = shallowRef(1)
export const seeking = shallowRef(false)
export const loading = shallowRef(false)
// #endregion

// #region initialize listeners
audio.value.addEventListener('play', () => {
  setPlaying(true)
})
audio.value.addEventListener('pause', () => {
  setPlaying(false)
})
audio.value.addEventListener('loadstart', () => {
  loading.value = true
})
audio.value.addEventListener('loadeddata', () => {
  loading.value = false
})
audio.value.addEventListener('canplay', () => {
  loading.value = false
})
audio.value.addEventListener('loadedmetadata', () => {
  duration.value = audio.value.duration
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
// #endregion

// #region getters
/**
 * 当前进度（0-1）
 */
export const progress = computed(() => duration.value === 0 ? 0 : currentTime.value / duration.value)
// #endregion

// #region actions
/**
 * 设置音频源
 */
export function setSrc(src: string) {
  audio.value.src = src
}

/**
 * 设置播放状态
 */
export function setPlaying(isPlaying: boolean) {
  playing.value = isPlaying
  if (isPlaying)
    audio.value.play()
  else
    audio.value.pause()
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
  volume.value = vol
  audio.value.volume = vol
}
// #endregion
