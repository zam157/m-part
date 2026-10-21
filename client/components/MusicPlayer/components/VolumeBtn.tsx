import { clsx } from 'cn/lite'
import { createMemo, createSignal, onCleanup } from 'solid-js'

export interface VolumeBtnProps {
  /** 当前音量 0-1（替代 v-model） */
  value: number
  onValueChange?: (value: number) => void
}

export default function VolumeBtn(props: VolumeBtnProps) {
  let containerRef: HTMLDivElement | undefined
  let volumeIconRef: HTMLDivElement | undefined
  let sliderRef: HTMLDivElement | undefined

  const [isDragging, setIsDragging] = createSignal(false)
  const [isHovering, setIsHovering] = createSignal(false)
  let volumeBeforeMuted = 0

  let closeTimer: ReturnType<typeof setTimeout> | null = null
  // 原实现每次 addEventListener 都传入新的函数引用，removeEventListener 因此删不掉，
  // 这里保存引用以便正确解绑（并在组件卸载时清理）。
  let closeClickHandler: ((event: MouseEvent) => void) | null = null

  function clearCloseClickHandler() {
    if (closeClickHandler) {
      removeEventListener('click', closeClickHandler)
      closeClickHandler = null
    }
  }

  onCleanup(() => {
    if (closeTimer) {
      clearTimeout(closeTimer)
      closeTimer = null
    }
    clearCloseClickHandler()
  })

  function setTimer() {
    closeTimer = setTimeout(() => {
      setIsHovering(false)
      closeTimer = null
    }, 300)
  }

  function updateVolume(clientY: number) {
    if (!sliderRef)
      return
    const rect = sliderRef.getBoundingClientRect()
    const next = 1 - Math.max(0, Math.min(1, (clientY - rect.top) / rect.height))
    props.onValueChange?.(next)
  }

  // #region 弹窗事件处理
  function handleMouseEnter() {
    if (closeTimer) {
      clearTimeout(closeTimer)
      closeTimer = null
    }
    setIsHovering(true)
  }

  function handleMouseLeave() {
    if (isDragging())
      return

    if (closeTimer) {
      clearTimeout(closeTimer)
      closeTimer = null
    }
    setTimer()
  }

  function handleVolumeIconClick(event: PointerEvent) {
    if (event.pointerType === 'mouse') {
      if (props.value === 0) {
        props.onValueChange?.(volumeBeforeMuted)
      }
      else {
        volumeBeforeMuted = props.value
        props.onValueChange?.(0)
      }

      return
    }
    handleVolumeIconTouchStart()
  }

  function handleVolumeIconTouchStart() {
    const next = !isHovering()
    setIsHovering(next)
    clearCloseClickHandler()

    if (!next)
      return

    closeClickHandler = (event: MouseEvent) => {
      if (!volumeIconRef || event.target === volumeIconRef || containerRef?.contains(event.target as Node))
        return
      setIsHovering(false)
    }
    addEventListener('click', closeClickHandler)
  }
  // #endregion

  function dragStart(event: PointerEvent) {
    if (event.pointerType === 'mouse' && event.button !== 0)
      return
    setIsDragging(true)

    // 捕获确保即使指针离开元素也能继续接收事件
    ;(event.target as HTMLElement).setPointerCapture(event.pointerId)
    updateVolume(event.clientY)
  }

  function onPointerMove(event: PointerEvent) {
    if (!isDragging())
      return
    updateVolume(event.clientY)
  }

  function onPointerUp(event: PointerEvent) {
    if (event.pointerType === 'mouse' && event.button !== 0)
      return
    if (!isDragging())
      return
    setIsDragging(false)

    // 释放捕获
    ;(event.target as HTMLElement).releasePointerCapture(event.pointerId)

    if (containerRef && !containerRef.contains(event.target as Node))
      setTimer()
  }

  const volumeIcon = createMemo(() => {
    if (props.value === 0)
      return 'i-solar:muted-bold'
    if (props.value < 0.5)
      return 'i-solar:volume-small-bold'
    return 'i-solar:volume-loud-bold'
  })

  return (
    <div
      ref={containerRef}
      class="flex relative"
      style={{ '--volume-percent': `${props.value * 100}%` }}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <div
        ref={volumeIconRef}
        class={clsx(volumeIcon(), 'text-5 text-primary transition-color hover:text-primary/80')}
        onPointerUp={handleVolumeIconClick}
      />

      <div
        class={clsx(
          'starting:opacity-0 starting:translate-y-2 transition-[opacity,translate,display] duration-200 transition-discrete',
          'mb-2 pb-1.5 pt-3 rounded-lg bg-popover flex flex-col w-9 shadow-lg items-center',
          'bottom-full left-1/2 justify-center absolute z-2 -translate-x-1/2',
          isHovering() ? 'opacity-100' : 'opacity-0 hidden translate-y-2',
        )}
      >
        <div
          ref={sliderRef}
          class="rounded-full bg-neutral-200 dark:bg-neutral-500 h-24 w-1.5 cursor-pointer relative touch-none"
          onPointerDown={dragStart}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onContextMenu={event => event.preventDefault()}
        >
          <div
            class="rounded-full bg-primary w-full bottom-0 absolute h-[--volume-percent]"
          />
          <div
            class={clsx(
              'rounded-full shadow-2xl translate-y-1/2 left-1/2 absolute -translate-x-1/2 bottom-[--volume-percent]',
              'transition-[transform,height,width,background-color] hover:scale-110',
              isDragging() ? 'scale-110 bg-primary/30 w-3.5 h-5' : 'bg-primary size-3',
            )}
          />
        </div>
        <div class="text-2.5 mt-1 font-mono">
          {Math.round(props.value * 100)}%
        </div>
        <div class="bg-popover h-2 w-2 rotate-45 left-1/2 absolute -translate-x-1/2 -bottom-1" />
      </div>
    </div>
  )
}
