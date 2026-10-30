import type { MusicInfo } from '@m-part/music/types/music-info'
import { imageUrl } from '@m-part/music/image'
import { createEffect, createRoot } from 'solid-js'
import { audio, currentSong, prevNext, setCurrentTime, setPlaying } from './player'
import { isRoomPlayer } from './player-context'

function artwork(music: MusicInfo): MediaImage[] {
  try {
    const url = new URL(imageUrl(music.provider, music.coverUrl, 'media-session'))
    return url.protocol === 'https:' ? [{ src: url.href }] : []
  }
  catch {
    return []
  }
}

/** 应用入口启动一次；系统媒体控制与页面共用同一个播放器。 */
export function startMediaSession() {
  const session = navigator.mediaSession
  if (!session || typeof session.setActionHandler !== 'function')
    return () => {}

  function setHandler(action: MediaSessionAction, handler: MediaSessionActionHandler | null) {
    try {
      session.setActionHandler(action, handler)
    }
    catch (error) {
      // 浏览器可能只支持部分 action，逐个注册，不能让单项缺失中断初始化。
      if (!(error instanceof DOMException && error.name === 'NotSupportedError'))
        throw error
    }
  }

  function syncPosition(hasSong: boolean) {
    if (typeof session.setPositionState !== 'function')
      return
    const duration = audio.duration
    const position = audio.currentTime
    const playbackRate = audio.playbackRate
    // 切歌加载期间清掉上一首的进度；NaN、无穷时长与非法速率不能传给系统。
    if (!hasSong || !audio.getAttribute('src') || audio.readyState < 1
      || !Number.isFinite(duration) || duration <= 0 || !Number.isFinite(position)
      || !Number.isFinite(playbackRate) || playbackRate <= 0) {
      session.setPositionState()
      return
    }
    session.setPositionState({ duration, position: Math.max(0, Math.min(position, duration)), playbackRate })
  }

  function syncPlayback(hasSong: boolean) {
    session.playbackState = !hasSong ? 'none' : audio.paused || audio.ended || audio.error ? 'paused' : 'playing'
    syncPosition(hasSong)
  }

  const onPlayback = () => syncPlayback(Boolean(currentSong()))
  const onPosition = () => syncPosition(Boolean(currentSong()))

  function seek(time: number) {
    if (!currentSong() || !Number.isFinite(time) || !Number.isFinite(audio.duration) || audio.duration <= 0 || audio.readyState < 1)
      return
    setCurrentTime(Math.max(0, Math.min(time, audio.duration)))
    syncPosition(true)
  }

  const actions: [MediaSessionAction, MediaSessionActionHandler][] = [
    ['play', () => { void setPlaying(true) }],
    ['pause', () => { void setPlaying(false) }],
    ['previoustrack', () => { void prevNext(0) }],
    ['nexttrack', () => { void prevNext(1) }],
    ['stop', () => { void setPlaying(false); if (!isRoomPlayer()) setCurrentTime(0); onPosition() }],
    ['seekto', details => { if (details.seekTime !== undefined) seek(details.seekTime) }],
    ['seekbackward', details => seek(audio.currentTime - (details.seekOffset ?? 10))],
    ['seekforward', details => seek(audio.currentTime + (details.seekOffset ?? 10))],
  ]
  const playbackEvents = ['play', 'playing', 'pause', 'ended', 'error', 'emptied'] as const
  const positionEvents = ['loadedmetadata', 'durationchange', 'timeupdate', 'seeked', 'ratechange'] as const
  const onVisible = () => {
    if (document.visibilityState === 'visible')
      onPlayback()
  }

  const disposeEffect = createRoot((dispose) => {
    createEffect(currentSong, (music) => {
      if (typeof MediaMetadata === 'function') {
        session.metadata = music ? new MediaMetadata({
          title: music.title,
          artist: music.artist ?? '',
          album: music.album ?? '',
          artwork: artwork(music),
        }) : null
      }
      for (const [action, handler] of actions)
        setHandler(action, music ? handler : null)
      // effect 执行阶段使用 compute 已追踪的值，不能在这里重新读 currentSong。
      syncPlayback(Boolean(music))
    })
    return dispose
  })

  for (const event of playbackEvents)
    audio.addEventListener(event, onPlayback)
  for (const event of positionEvents)
    audio.addEventListener(event, onPosition)
  document.addEventListener('visibilitychange', onVisible)
  window.addEventListener('pageshow', onVisible)

  return () => {
    disposeEffect()
    for (const [action] of actions)
      setHandler(action, null)
    for (const event of playbackEvents)
      audio.removeEventListener(event, onPlayback)
    for (const event of positionEvents)
      audio.removeEventListener(event, onPosition)
    document.removeEventListener('visibilitychange', onVisible)
    window.removeEventListener('pageshow', onVisible)
    session.metadata = null
    session.playbackState = 'none'
    session.setPositionState?.()
  }
}
