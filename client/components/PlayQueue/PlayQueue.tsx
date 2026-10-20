import { clsx } from 'cn/lite'
import { For, Show } from 'solid-js'
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
      class="play-queue-panel"
      data-open={showPlayQueue() ? 'true' : 'false'}
      aria-hidden={showPlayQueue() ? 'false' : 'true'}
      inert={!showPlayQueue()}
    >
      <div class="play-queue-content bg-sidebar text-sidebar-foreground border-l border-sidebar-border">
        <header class="flex items-center justify-between px-4 py-5 border-b border-border">
          <div><h2 class="text-sm font-semibold">播放队列</h2><p class="text-xs text-muted-foreground mt-1">{playQueue().length} 首待聆听的声音</p></div>
          <button class="ghost-btn size-8" aria-label="关闭播放队列" onClick={() => setShowPlayQueue(false)}><span class="i-lucide:x text-4" /></button>
        </header>
        <Show when={!playQueue().length}><div class="empty text-muted-foreground"><span class="i-lucide:list-music text-7" /><p class="text-sm">队列还是空的</p><p class="text-xs">在搜索结果中选择一首歌曲。</p></div></Show>
        <div class="flex-1 min-h-0 p-2 of-y-auto">
          <For each={playQueue()}>
            {(song, index) => (
              <div
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
