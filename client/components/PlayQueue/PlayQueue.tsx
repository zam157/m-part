import { clsx } from 'cn/lite'
import { createEffect, For, Show, untrack } from 'solid-js'
import MusicContextMenu from '~/components/MusicContextMenu/MusicContextMenu'
import {
  clearPlayQueue,
  currentIndex,
  playing,
  playQueue,
  removeFromPlayQueue,
  setCurrentIndex,
  setPlaying,
  setShowPlayQueue,
  showPlayQueue,
} from '~/composables/player'
import './play-queue.css'

export default function PlayQueue() {
  let panelRef: HTMLDivElement | undefined
  let returnFocus: HTMLElement | undefined

  createEffect(showPlayQueue, (open) => {
    const activeElement = document.activeElement
    const fallbackTrigger = () => document.querySelector<HTMLButtonElement>('button[aria-controls="play-queue"]')

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

  async function handleItemClick(index: number) {
    if (currentIndex() === index) {
      await setPlaying(!playing())
      return
    }
    await setCurrentIndex(index)
    await setPlaying(true)
  }

  function handleClear() {
    clearPlayQueue()
    setShowPlayQueue(false)
  }

  return (
    <div
      id="play-queue"
      ref={panelRef}
      class="play-queue-panel [--queue-width:20rem] flex-none min-h-0 overflow-hidden max-[760px]:[--queue-width:min(20rem,calc(100vw-64px))] max-[760px]:fixed max-[760px]:right-0 max-[760px]:top-0 max-[760px]:bottom-[--player-height] max-[760px]:z-30 max-[760px]:shadow-[-8px_0_30px_#0002] motion-reduce:transition-none"
      data-open={showPlayQueue() ? 'true' : 'false'}
      inert={!showPlayQueue()}
    >
      <div class="flex flex-col gap-0.5 w-[--queue-width] h-full overflow-hidden bg-sidebar text-sidebar-foreground border-l border-sidebar-border">
        <header class="shrink-0 flex items-center justify-between px-4 py-5 border-b border-border">
          <div><h2 class="text-sm font-semibold">播放队列</h2><p class="text-xs text-muted-foreground mt-1">{playQueue().length} 首待聆听的声音</p></div>
          <button class="ghost-btn size-8" aria-label="关闭播放队列" onClick={() => setShowPlayQueue(false)}><span class="i-lucide:x text-4" /></button>
        </header>
        <Show when={!playQueue().length}><div class="empty text-muted-foreground"><span class="i-lucide:list-music text-7" /><p class="text-sm">队列还是空的</p><p class="text-xs">在搜索结果中选择一首歌曲。</p></div></Show>
        <div class="flex-1 min-h-0 p-2 of-y-auto">
          <For each={playQueue()}>
            {(song, index) => (
              <MusicContextMenu music={song}>{trigger => (
                <div
                  {...trigger}
                  class={clsx(
                    'ghost-btn flex px-2 h-12 justify-start content-visibility-auto',
                    currentIndex() === index() && 'bg-accent text-accent-foreground',
                  )}
                >
                  <div
                    class="group cover-container relative size-9 rounded-md bg-neutral-200 dark:bg-neutral-500 shrink-0"
                    onClick={() => handleItemClick(index())}
                  >
                    <Show when={song.coverUrl}>
                      <img src={song.coverUrl} class="w-full h-full rounded-md" />
                    </Show>
                    <div
                      class={clsx(
                        'play-icon text-3 block absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2',
                        'transition-[opacity,display] transition-discrete group-hover:opacity-100 group-hover:block',
                        playing() && currentIndex() === index() ? 'i-solar:pause-bold' : 'i-solar:play-bold',
                        currentIndex() !== index() && 'opacity-0 hidden',
                      )}
                    />
                  </div>
                  <div class="flex-1 min-w-0 flex flex-col">
                    <span class="max-w-full truncate" innerHTML={song.title} />
                    <span class="text-xs text-muted-foreground truncate max-w-full truncate">{song.artist}</span>
                  </div>
                  <div
                    class="i-solar:close-circle-bold text-3.5 hover:text-destructive transition-color grow-0 shrink-0"
                    onClick={(event) => {
                      event.stopPropagation()
                      removeFromPlayQueue(index())
                    }}
                  />
                </div>
              )}</MusicContextMenu>
            )}
          </For>
        </div>

        {/* footer */}
        <div class="shrink-0 p-3 flex items-center border-t border-border">
          <button class="ghost-btn px-3 text-muted-foreground" disabled={!playQueue().length} onClick={handleClear}>
            <span class="i-lucide:trash-2 text-4" />清空队列
          </button>
        </div>
      </div>
    </div>
  )
}
