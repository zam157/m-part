import type { MusicQuality } from '#shared/types/music-info'
import { clsx } from 'cn/lite'
import { createMemo, createSignal, Show } from 'solid-js'
import ErrorMessage from '~/components/ErrorMessage/ErrorMessage'
import Tooltip from '~/components/Tooltip/Tooltip'
import {
  changeQuality, currentSong, currentSourceInfo, currentTime, duration, playbackError,
  playing, playMode, prevNext, progress, seeking, setCurrentTime,
  setPlaying, setShowPlayQueue, setSrc, setVolume, setWaiting, showPlayQueue,
  togglePlayMode, volume, waiting,
} from '~/composables/player'
import Expended from './components/Expended'
import QualityBtn from './components/QualityBtn'
import VolumeBtn from './components/VolumeBtn'
import VolumeSlider from './components/VolumeSlider'
import './music-player.css'

function formatTime(seconds: number): string {
  const total = Math.max(0, Math.floor(Number.isFinite(seconds) ? seconds : 0))
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`
}

export default function MusicPlayer() {
  let progressBarRef!: HTMLDivElement
  const [tempProgress, setTempProgress] = createSignal<number | null>(null)
  const [scrubbing, setScrubbing] = createSignal(false)
  const [showExpended, setShowExpended] = createSignal(false)
  // 手势中需要同步读写，不能依赖 Solid 2 暂存的 signal 值。
  let drag: { left: number, width: number, progress: number } | null = null
  const hasSong = () => !!currentSong()
  const trackDuration = () => Number.isFinite(duration()) ? Math.max(0, duration()) : 0
  const canSeek = () => hasSong() && trackDuration() > 0 && !waiting()
  const showSpinner = createMemo(() => waiting() || seeking())
  const displayProgress = createMemo(() => Math.max(0, Math.min(1, tempProgress() ?? progress())) || 0)
  const displaySeconds = () => tempProgress() === null ? currentTime() : displayProgress() * trackDuration()
  const playModeLabel = () => ({ order: '顺序播放', loop: '列表循环', random: '随机播放', 'single-loop': '单曲循环' }[playMode()])
  const playModeIcon = () => ({
    order: 'i-lucide:list-ordered', loop: 'i-lucide:repeat',
    random: 'i-lucide:shuffle', 'single-loop': 'i-lucide:repeat-1',
  }[playMode()])

  function updateTempProgress(clientX: number) {
    if (!drag)
      return
    drag.progress = Math.max(0, Math.min(1, (clientX - drag.left) / drag.width))
    setTempProgress(drag.progress)
  }

  function handlePointerDown(event: PointerEvent) {
    if (!canSeek() || event.button !== 0)
      return
    const rect = progressBarRef.getBoundingClientRect()
    if (!rect.width)
      return
    drag = { left: rect.left, width: rect.width, progress: displayProgress() }
    setScrubbing(true)
    updateTempProgress(event.clientX)
    ;(event.currentTarget as HTMLElement).setPointerCapture(event.pointerId)
  }

  function finishDrag(event: PointerEvent, commit: boolean) {
    if (!drag)
      return
    if (commit) {
      updateTempProgress(event.clientX)
      setCurrentTime(drag.progress * trackDuration())
    }
    drag = null
    setTempProgress(null)
    setScrubbing(false)
    if (progressBarRef.hasPointerCapture(event.pointerId))
      progressBarRef.releasePointerCapture(event.pointerId)
  }

  function handleSeekKey(event: KeyboardEvent) {
    if (!canSeek())
      return
    let next: number
    if (event.key === 'ArrowRight' || event.key === 'ArrowUp')
      next = currentTime() + 5
    else if (event.key === 'ArrowLeft' || event.key === 'ArrowDown')
      next = currentTime() - 5
    else if (event.key === 'Home')
      next = 0
    else if (event.key === 'End')
      next = trackDuration()
    else
      return
    event.preventDefault()
    setCurrentTime(Math.max(0, Math.min(trackDuration(), next)))
  }

  async function handleQualitySelect(quality: MusicQuality) {
    setWaiting(true)
    const currentTimeBeforeChange = currentTime()
    try {
      await setPlaying(false)
      await changeQuality(quality)
      setCurrentTime(currentTimeBeforeChange)
      await setPlaying(true)
    }
    finally {
      setWaiting(false)
    }
  }

  return (
    <footer aria-label="音乐播放器" class="relative shrink-0 bg-background select-none">
      <Show when={playbackError()}>
        <ErrorMessage
          message={playbackError() ?? ''}
          onRetry={async () => {
            await setSrc(null, currentSong()?.provider)
            await setPlaying(true)
          }}
          class="flex-none flex-row gap-3 p-3 border-b border-border"
        />
      </Show>
      <div class="grid grid-cols-[minmax(180px,1fr)_minmax(0,460px)_minmax(180px,1fr)] items-center gap-x-5 h-[--player-height] px-6 border-t border-border max-[760px]:grid-cols-[minmax(0,1fr)_auto] max-[760px]:gap-x-2 max-[760px]:gap-y-1 max-[760px]:px-4 max-[760px]:py-2 max-[400px]:px-3">
        <div role="group" aria-label="播放控制" class="flex items-center gap-1 justify-self-start max-[760px]:row-start-2">
          <Tooltip content={`${playModeLabel()}，点击切换`}>
            {trigger => (
              <button {...trigger} class="ghost-btn size-8 text-muted-foreground" disabled={!hasSong()} aria-label={`播放模式：${playModeLabel()}`} onClick={togglePlayMode}>
                <span class={clsx(playModeIcon(), 'text-4')} />
              </button>
            )}
          </Tooltip>
          <button class="ghost-btn size-9" disabled={!hasSong()} aria-label="上一首" onClick={() => prevNext(0)}><span class="i-solar:skip-previous-bold text-5" /></button>
          <button class="ghost-btn size-11" disabled={!hasSong()} aria-label={playing() ? '暂停' : '播放'} onClick={() => setPlaying(!playing())}>
            <span class={clsx('text-7', showSpinner() ? 'i-lucide:loader-circle animate-spin motion-reduce:animate-none' : playing() ? 'i-solar:pause-bold' : 'i-solar:play-bold')} />
          </button>
          <button class="ghost-btn size-9" disabled={!hasSong()} aria-label="下一首" onClick={() => prevNext(1)}><span class="i-solar:skip-next-bold text-5" /></button>
        </div>

        <div role="group" aria-label="当前歌曲" class="flex min-w-0 items-center gap-3 rounded-lg bg-muted/55 p-2 max-[760px]:col-span-2 max-[760px]:row-start-1">
          <button class="group/cover relative size-12 shrink-0 overflow-hidden rounded-md bg-muted outline-none focus-visible:ring-2 focus-visible:ring-ring" disabled={!hasSong()} aria-label="展开播放器" onClick={() => setShowExpended(true)}>
            <Show when={currentSong()?.coverUrl} fallback={<span class="i-lucide:music-2 text-6 text-muted-foreground" />}>
              <img src={currentSong()!.coverUrl} alt="当前歌曲封面" referrerpolicy="no-referrer" class="size-full object-cover" />
            </Show>
            <span class="absolute inset-0 grid place-items-center bg-black/35 text-white opacity-0 transition-opacity group-hover/cover:opacity-100 group-focus-visible/cover:opacity-100"><span class="i-lucide:chevrons-up text-5" /></span>
          </button>
          <div class="flex-1 min-w-0">
            <div class="text-center min-w-0">
              <span class="block truncate text-[13px] leading-4 font-semibold" innerHTML={currentSong()?.title || '尚未播放'} />
              <span class="block truncate text-[11px] leading-4 text-muted-foreground">{hasSong() ? currentSong()?.artist || '未知创作者' : '搜索或选择一首歌曲，开始聆听'}</span>
            </div>
            <div class="flex items-center gap-2 text-[10px] leading-3 tabular-nums text-muted-foreground">
              <span class="min-w-7 text-left">{formatTime(displaySeconds())}</span>
              <div
                ref={progressBarRef}
                role="slider"
                aria-label="播放进度"
                aria-valuemin={0}
                aria-valuemax={trackDuration()}
                aria-valuenow={Math.floor(displaySeconds()) || 0}
                aria-valuetext={`${formatTime(displaySeconds())}，共 ${formatTime(trackDuration())}`}
                aria-disabled={canSeek() ? 'false' : 'true'}
                tabindex={canSeek() ? 0 : -1}
                style={{ '--progress-percent': `${displayProgress() * 100}%` }}
                class="group/progress relative flex-1 h-4 flex items-center rounded-full touch-none cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-ring aria-disabled:cursor-default"
                onPointerDown={handlePointerDown}
                onPointerMove={event => drag && updateTempProgress(event.clientX)}
                onPointerUp={event => finishDrag(event, true)}
                onPointerCancel={event => finishDrag(event, false)}
                onLostPointerCapture={event => finishDrag(event, false)}
                onKeyDown={handleSeekKey}
                onContextMenu={event => event.preventDefault()}
              >
                <div class="relative h-1 w-full rounded-full bg-foreground/12">
                  <div class="h-full w-[--progress-percent] rounded-full bg-foreground/55" />
                  <span class={clsx('absolute top-1/2 left-[--progress-percent] -translate-x-1/2 -translate-y-1/2 size-2 rounded-full bg-foreground opacity-0 transition-opacity group-hover/progress:opacity-100 group-focus-visible/progress:opacity-100', scrubbing() && 'opacity-100')} />
                </div>
              </div>
              <span class="min-w-7 text-right">−{formatTime(trackDuration() - displaySeconds())}</span>
            </div>
          </div>
        </div>

        <div role="group" aria-label="播放设置" class="flex items-center gap-3 justify-self-end max-[760px]:row-start-2 max-[760px]:gap-2">
          <div class="max-[1100px]:hidden"><VolumeSlider value={volume()} onValueChange={setVolume} /></div>
          <div class="hidden max-[1100px]:block"><VolumeBtn value={volume()} onValueChange={setVolume} /></div>
          <Show when={currentSourceInfo()?.qualities?.length}>
            <QualityBtn qualities={currentSourceInfo()!.qualities!} onSelect={handleQualitySelect} />
          </Show>
          <span class="h-5 w-px bg-border max-[760px]:hidden" aria-hidden="true" />
          <Tooltip content={showPlayQueue() ? '关闭播放队列' : '播放队列'}>
            {trigger => (
              <button {...trigger} class={clsx('ghost-btn size-9', showPlayQueue() && 'bg-accent text-accent-foreground')} aria-label="播放队列" aria-controls="play-queue" aria-expanded={showPlayQueue() ? 'true' : 'false'} onClick={() => setShowPlayQueue(!showPlayQueue())}>
                <span class="i-lucide:list-music text-4.5" />
              </button>
            )}
          </Tooltip>
        </div>
      </div>
      <Expended show={showExpended()} onShowChange={setShowExpended} />
    </footer>
  )
}
