import type { MusicQuality } from '#shared/types/music-info'
import { clsx } from 'cn/lite'
import { Show, createMemo, createSignal } from 'solid-js'
import {
  changeQuality,
  currentSong,
  currentSourceInfo,
  currentTime,
  duration,
  playing,
  playQueue,
  playMode,
  prevNext,
  progress,
  seeking,
  setCurrentTime,
  setPlaying,
  setShowPlayQueue,
  setVolume,
  setWaiting,
  showPlayQueue,
  togglePlayMode,
  volume,
  waiting,
} from '~/composables/player'
import './music-player.css'
import Expended from './components/Expended'
import QualityBtn from './components/QualityBtn'
import VolumeBtn from './components/VolumeBtn'

/**
 * 格式化时间为 MM:SS 格式
 */
function formatTime(seconds: number): string {
  const totalSeconds = Math.floor(seconds)
  const minutes = Math.floor(totalSeconds / 60)
  const secs = totalSeconds % 60
  return `${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
}

export default function MusicPlayer() {
  let progressBarRef: HTMLDivElement | undefined

  const [tempProgress, setTempProgress] = createSignal<number | null>(null)
  const [scrubbing, setScrubbing] = createSignal(false)
  const [showExpended, setShowExpended] = createSignal(false)

  // 本次手势中进度条的位置缓存。刻意用普通变量而不是 signal：它是同一次手势内的中间量，
  // pointerdown 里写入后需要在同一个同步块里读，而 Solid 2 的 signal 写入要到下一次
  // flush 才提交（写完立刻读拿到 null），那样没经过 pointermove 的纯点击就算不出位置。
  let progressBarRect: { width: number, left: number } | null = null

  const showSpinner = createMemo(() => waiting() || seeking())

  // 计算显示的进度（拖动时使用 tempProgress）
  const displayProgress = createMemo(() => tempProgress() ?? progress())

  // 计算显示的时间（拖动时显示拖动位置的时间）
  const displayTime = createMemo(() => {
    const temp = tempProgress()
    if (temp !== null)
      return `${formatTime(temp * duration())}/${formatTime(duration())}`
    return `${formatTime(currentTime())}/${formatTime(duration())}`
  })

  const playModeIcon = createMemo(() => ({
    'loop': 'i-solar-repeat-bold',
    'random': 'i-solar:shuffle-linear',
    'single-loop': 'i-solar:repeat-one-linear',
    'order': 'i-solar:list-arrow-down-linear',
  }[playMode()]))

  function updateTempProgress(clientX: number) {
    if (!progressBarRect)
      return

    const { width, left } = progressBarRect
    setTempProgress(Math.max(0, Math.min(1, (clientX - left) / width)))
  }

  function handlePointerDown(event: PointerEvent) {
    if (waiting())
      return
    if (event.pointerType === 'mouse' && event.button !== 0)
      return
    setScrubbing(true)
    // 在 pointerdown 时缓存进度条位置，避免频繁的 getBoundingClientRect 调用
    const rect = progressBarRef!.getBoundingClientRect()
    progressBarRect = { width: rect.width, left: rect.left }
    updateTempProgress(event.clientX)
    ;(event.target as HTMLElement).setPointerCapture(event.pointerId)
  }

  function handlePointerMove(event: PointerEvent) {
    if (!scrubbing())
      return
    updateTempProgress(event.clientX)
  }

  function handlePointerUp(event: PointerEvent) {
    if (waiting())
      return
    if (event.pointerType === 'mouse' && event.button !== 0)
      return
    if (!scrubbing())
      return
    setScrubbing(false)
    ;(event.target as HTMLElement).releasePointerCapture(event.pointerId)

    const temp = tempProgress()
    if (temp !== null) {
      setCurrentTime(temp * duration())
      setTempProgress(null)
    }

    // 清除缓存的位置信息
    progressBarRect = null
  }

  async function handleQualitySelect(quality: MusicQuality) {
    setWaiting(true)
    const currentTimeBeforeChange = currentTime()
    try {
      await setPlaying(false)
      await changeQuality(quality)
      // 切换音质后保持当前时间不变
      setCurrentTime(currentTimeBeforeChange)
      await setPlaying(true)
    }
    finally {
      setWaiting(false)
    }
  }

  return (
    <div
      style={{
        '--progress-percent': `${displayProgress() * 100}%`,
        '--thumb-width': 'calc(var(--spacing) * 3.5)',
        '--thumb-height': 'var(--thumb-width)',
        '--progress-height': 'var(--spacing)',
      }}
      class={clsx(
        'grow-0 shrink-0 flex flex-col select-none relative',
        'transition-[transform,display] transition-discrete starting:translate-y-full',
        playQueue().length === 0 && 'translate-y-full hidden',
      )}
    >
      {/* Progress bar */}
      <div class="relative h-[--progress-height]">
        <div
          ref={progressBarRef}
          class="progress-bar-wrapper cursor-pointer absolute bottom-0 left-0 w-full z-1"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onContextMenu={event => event.preventDefault()}
        >
          {/* Tooltip */}
          <Show when={duration()}>
            <div
              class="
                time-tooltip
                absolute text-sm text-neutral-50 font-mono whitespace-nowrap px-2 py-1 rounded-lg bg-neutral-700 opacity-0 invisible pointer-events-none
                transition-[opacity,visibility] duration-200
              "
            >
              {displayTime()}
            </div>
          </Show>

          <div
            class={clsx(
              'progress-bar h-[--progress-height] transition-height duration-300 relative touch-none',
              'bg-neutral-200 dark:bg-neutral-500 will-change-transform',
              showSpinner() && 't-loading',
            )}
          >
            <div
              class="relative rounded-r-full bg-primary h-full"
              style={{ width: 'var(--progress-percent)' }}
            >
              <div
                class={clsx(
                  'thumb rounded-full flex items-center justify-center shadow-md w-[--thumb-width] h-[--thumb-height]',
                  'transition-[opacity,visibility,height,width,background-color]',
                  'absolute top-1/2 right-0 translate-x-1/2 -translate-y-1/2',
                  scrubbing() ? 'bg-primary/30' : 'bg-primary',
                )}
                style={scrubbing() ? { '--thumb-width': 'calc(var(--spacing) * 6)' } : undefined}
              >
                <div
                  class={clsx(
                    'i-solar-refresh-bold text-2.5 text-primary-foreground',
                    'transition-[opacity,display] transition-discrete starting:opacity-0 animate-spin',
                    !showSpinner() && 'hidden opacity-0',
                  )}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Music player */}
      <div class="@container flex h-19">
        {/* Music image */}
        <div
          class="cover-wrapper overflow-hidden relative dark:bg-neutral-200 bg-neutral-500 h-full aspect-1"
          onClick={() => setShowExpended(v => !v)}
        >
          <Show when={currentSong()?.coverUrl}>
            <img
              src={currentSong()!.coverUrl}
              referrerpolicy="no-referrer"
              class="h-full w-full object-cover transition-filter"
            />
          </Show>
          <div
            class="i-lucide:chevrons-up absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-transparent text-10 transition-[color,transform] duration-200"
          />
        </div>

        {/* Music info */}
        <div class="mx-4 flex flex-1 flex-col gap-2 min-w-0 items-start justify-center">
          {/* Song name */}
          <span class="text-primary font-bold max-w-full min-w-0 truncate" innerHTML={currentSong()?.title || 'Unknown Song'} />
          {/* Artist name */}
          <span class="text-xs text-zinc-400 max-w-full min-w-0 truncate">
            {currentSong()?.artist || 'Unknown Artist'}
          </span>
        </div>

        {/* Extra buttons */}
        <div class="px-2 flex gap-4 items-center justify-center">
          <div
            class="i-solar-playlist-bold text-5 text-primary transition-color hover:text-primary/80"
            onClick={() => setShowPlayQueue(!showPlayQueue())}
          />
          <div
            class={clsx(playModeIcon(), 'text-5 text-primary transition-color hover:text-primary/80')}
            onClick={togglePlayMode}
          />
          <VolumeBtn value={volume()} onValueChange={setVolume} />
          <Show when={currentSourceInfo()?.qualities?.length}>
            <QualityBtn
              qualities={currentSourceInfo()!.qualities!}
              onSelect={handleQualitySelect}
            />
          </Show>
        </div>

        {/* Play button */}
        <div class="btn-wrapper ml-2 mr-2 flex gap-2 items-center @lg:mr-6 @md:mr-4 @lg:gap-4 @md:gap-3">
          <div class="i-solar:skip-previous-bold text-5 text-primary transition-color hover:text-primary/80" onClick={() => prevNext(0)} />
          <div
            class={clsx(
              'text-9 text-primary transition-[transform,color] hover:scale-110 hover:text-primary/80',
              playing() ? 'i-solar:pause-circle-bold' : 'i-solar:play-circle-bold',
            )}
            onClick={() => setPlaying(!playing())}
          />
          <div class="i-solar:skip-next-bold text-5 text-primary transition-color hover:text-primary/80" onClick={() => prevNext(1)} />
        </div>
      </div>
      <Expended show={showExpended()} onShowChange={setShowExpended} />
    </div>
  )
}
