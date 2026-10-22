import type { MusicQuality } from '#shared/types/music-info'
import { audio, changeQuality, currentSong, currentTime, playing, playMode, setCurrentTime, setPlaying, setSrc, setWaiting } from '~/composables/player'
import { dispatchRoomPlayer } from '~/composables/player-context'

export function formatTime(seconds: number): string {
  const total = Math.max(0, Math.floor(Number.isFinite(seconds) ? seconds : 0))
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`
}
export const playModeLabel = () => ({ order: '顺序播放', loop: '列表循环', random: '随机播放', 'single-loop': '单曲循环' }[playMode()])

export async function selectQuality(quality: MusicQuality) {
  if (dispatchRoomPlayer({ type: 'quality', quality })) return
  const wasPlaying = playing()
  const time = currentTime()
  setWaiting(true)
  try {
    await setPlaying(false)
    await changeQuality(quality)
    setCurrentTime(time)
    await setPlaying(wasPlaying)
  }
  finally {
    setWaiting(false)
  }
}
export async function retryPlayback() {
  if (dispatchRoomPlayer({ type: 'retry' })) return
  await setSrc(null, currentSong()?.provider)
  await setPlaying(true)
}

/** 通知自动关闭后，播放按钮仍能重新获取失败的音源。 */
export async function togglePlayback() {
  if (!playing() && (!audio.getAttribute('src') || audio.error)) {
    await retryPlayback()
    return
  }
  await setPlaying(!playing())
}
