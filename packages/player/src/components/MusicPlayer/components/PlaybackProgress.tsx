import { clsx } from 'cn/lite'
import { createMemo, createSignal } from 'solid-js'
import { currentSong, currentTime, duration, progress, setCurrentTime, waiting } from '~/composables/player'
import { canControlRoom } from '~/composables/player-context'
import { formatTime } from './player-controls'

export default function PlaybackProgress(props: { expanded?: boolean }) {
  let progressBarRef!: HTMLDivElement
  const [tempProgress, setTempProgress] = createSignal<number | null>(null)
  const [scrubbing, setScrubbing] = createSignal(false)
  // 手势中需要同步读写，不能依赖 Solid 2 暂存的 signal 值。
  let drag: { left: number, width: number, progress: number } | null = null
  const hasSong = () => !!currentSong()
  const trackDuration = () => Number.isFinite(duration()) ? Math.max(0, duration()) : 0
  const canSeek = () => canControlRoom() && hasSong() && trackDuration() > 0 && !waiting()
  const displayProgress = createMemo(() => Math.max(0, Math.min(1, tempProgress() ?? progress())) || 0)
  const displaySeconds = () => tempProgress() === null ? currentTime() : displayProgress() * trackDuration()
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


  return (
    <div class={clsx('flex items-center gap-x-2 tabular-nums text-muted-foreground', props.expanded ? 'flex-wrap text-xs' : 'text-[10px] leading-3')}>
      <span class={clsx('min-w-7 text-left', props.expanded && 'order-2')}>{formatTime(displaySeconds())}</span>
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
        class={clsx('group/progress relative flex items-center rounded-full touch-none cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-ring aria-disabled:cursor-default', props.expanded ? 'order-1 basis-full h-6' : 'flex-1 h-4')}
        onPointerDown={handlePointerDown}
        onPointerMove={event => drag && updateTempProgress(event.clientX)}
        onPointerUp={event => finishDrag(event, true)}
        onPointerCancel={event => finishDrag(event, false)}
        onLostPointerCapture={event => finishDrag(event, false)}
        onKeyDown={handleSeekKey}
        onContextMenu={event => event.preventDefault()}
      >
        <div class={clsx('relative w-full rounded-full bg-foreground/12', props.expanded ? 'h-1.5' : 'h-1')}>
          <div class="h-full w-[--progress-percent] rounded-full bg-foreground/55" />
          <span class={clsx('absolute top-1/2 left-[--progress-percent] -translate-x-1/2 -translate-y-1/2 size-2 rounded-full bg-foreground opacity-0 transition-opacity group-hover/progress:opacity-100 group-focus-visible/progress:opacity-100', scrubbing() && 'opacity-100')} />
        </div>
      </div>
      <span class={clsx('min-w-7 text-right', props.expanded && 'order-3 ml-auto')}>−{formatTime(trackDuration() - displaySeconds())}</span>
    </div>
  )
}
