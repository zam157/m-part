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
      class={`
        flex flex-col of-hidden
        gap-0.5 bg-sidebar text-sidebar-foreground grow-0 shrink-0
        starting:w-0 transition-[width,display] duration-300 transition-discrete
        border-l border-sidebar-border
        ${showPlayQueue() ? 'w-80' : 'w-0 hidden'}
      `}
    >
      <div class="flex-1 min-h-0 p-2 of-y-auto">
        <For each={playQueue()}>
          {(song, index) => (
            <div
              class={`ghost-btn flex px-2 h-12 justify-start content-visibility-auto ${currentIndex() === index() ? 'bg-accent text-accent-foreground' : ''}`.trim()}
            >
              <div
                class="group cover-container relative size-9 rounded-md bg-neutral-200 dark:bg-neutral-500 shrink-0"
                onClick={() => handleItemClick(index())}
              >
                <Show when={song.coverUrl}>
                  <img src={song.coverUrl} class="w-full h-full rounded-md" />
                </Show>
                <div
                  class={`play-icon text-3 block absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 transition-[opacity,display] transition-discrete group-hover:opacity-100 group-hover:block ${
                    playing() && currentIndex() === index() ? 'i-solar:pause-bold' : 'i-solar:play-bold'
                  } ${currentIndex() === index() ? '' : 'opacity-0 hidden'}`}
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
      <div class="shrink-0 p-2 flex items-center">
        <div class="ghost-btn p-2 text-4" onClick={handleClear}>
          <div class="i-solar:trash-bin-trash-bold" />
        </div>
      </div>
    </div>
  )
}
