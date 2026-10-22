import { clsx } from 'cn/lite'
import { createEffect, untrack } from 'solid-js'
import { clearPlayQueue, currentIndex, playQueue, setShowPlayQueue, showPlayQueue } from '~/composables/player'
import type { QueueTracksApi } from './QueueTracks'
import QueueTracks from './QueueTracks'
import './play-queue.css'

export default function PlayQueue(props: { floating?: boolean, open?: boolean, onOpenChange?: (open: boolean) => void }) {
  const isOpen = () => props.floating ? !!props.open : showPlayQueue()
  const setOpen = (open: boolean) => props.floating ? props.onOpenChange?.(open) : setShowPlayQueue(open)
  let panelRef: HTMLDivElement | undefined
  let returnFocus: HTMLElement | undefined
  let tracks: QueueTracksApi | undefined

  createEffect(isOpen, (open) => {
    if (!props.floating || !panelRef) return
    untrack(() => {
      if (open && !panelRef!.matches(':popover-open')) panelRef!.showPopover()
      else if (!open && panelRef!.matches(':popover-open')) panelRef!.hidePopover()
    })
  })
  createEffect(isOpen, (open) => {
    const activeElement = document.activeElement
    const fallbackTrigger = () => document.querySelector<HTMLButtonElement>(`button[aria-controls="${props.floating ? 'expanded-play-queue' : 'play-queue'}"]`)

    if (open) {
      returnFocus = activeElement instanceof HTMLElement && activeElement !== document.body && !panelRef?.contains(activeElement)
        ? activeElement
        : fallbackTrigger() ?? undefined
      return
    }

    // inert 可能已经把队列内的焦点移到 body；外部控件已有焦点时不抢焦点。
    if (returnFocus && (activeElement === document.body || panelRef?.contains(activeElement))) {
      const target = returnFocus.isConnected ? returnFocus : fallbackTrigger()
      // focus 会同步触发入口的 Tooltip 事件，避免让事件继承 effect 的严格读取上下文。
      untrack(() => target?.focus({ preventScroll: true }))
    }
    returnFocus = undefined
  })

  function handleClear() {
    clearPlayQueue()
    setOpen(false)
  }

  return (
    <div
      id={props.floating ? 'expanded-play-queue' : 'play-queue'}
      popover={props.floating ? 'auto' : undefined}
      onToggle={(event) => { if (props.floating) setOpen(event.newState === 'open') }}
      aria-label="播放队列"
      ref={panelRef}
      class={clsx(props.floating
        ? 'play-queue-floating fixed m-0 left-auto right-4 top-20 bottom-4 w-[min(24rem,calc(100vw-32px))] max-h-none max-w-none h-auto p-0 rounded-xl border border-border bg-popover text-popover-foreground shadow-2xl overflow-hidden max-[900px]:top-17'
        : 'play-queue-panel [--queue-width:20rem] flex-none min-h-0 overflow-hidden max-[760px]:[--queue-width:min(20rem,calc(100vw-64px))] max-[760px]:fixed max-[760px]:right-0 max-[760px]:top-0 max-[760px]:bottom-[--player-height] max-[760px]:z-30 max-[760px]:shadow-[-8px_0_30px_#0002]', 'motion-reduce:transition-none')}
      data-open={isOpen() ? 'true' : 'false'}
      inert={!isOpen()}
    >
      <div class={clsx('flex flex-col h-full overflow-hidden', props.floating ? 'w-full' : 'w-[--queue-width] bg-sidebar text-sidebar-foreground border-l border-sidebar-border')}>
        <header class="shrink-0 flex items-center justify-between px-3 py-3 border-b border-border">
          <div><h2 class="text-sm font-semibold">播放队列</h2><p class="text-xs text-muted-foreground mt-1">{playQueue().length} 首歌曲</p></div>
          <div class="flex items-center gap-1">
            <button type="button" class="ghost-btn size-8" aria-label="定位当前歌曲" title="定位当前歌曲" disabled={currentIndex() === null || !playQueue()[currentIndex()!]} onClick={() => tracks?.scrollToCurrent()}><span class="i-lucide:locate-fixed text-4" /></button>
            <button class="ghost-btn size-8" aria-label="关闭播放队列" onClick={() => setOpen(false)}><span class="i-lucide:x text-4" /></button>
          </div>
        </header>
        <QueueTracks open={isOpen()} ref={(api) => { tracks = api }} />

        {/* footer */}
        <div class="shrink-0 p-2 flex items-center border-t border-border">
          <button aria-label="清空播放队列" class="ghost-btn px-3 text-muted-foreground" disabled={!playQueue().length} onClick={handleClear}>
            <span class="i-lucide:trash-2 text-4" />清空队列
          </button>
        </div>
      </div>
    </div>
  )
}
