import { clsx } from 'cn/lite'
import { createEffect, For, Show, untrack } from 'solid-js'
import ContextMenu from '~/components/ContextMenu/ContextMenu'
import { currentIndex, playing, playQueue, removeFromPlayQueue, setCurrentIndex, setPlaying, openBiliParts } from '~/composables/player'
import { canControlRoom } from '~/composables/player-context'
import { formatTime } from '~/components/MusicPlayer/components/player-controls'

export interface QueueTracksApi {
  scrollToCurrent: () => void
}

export default function QueueTracks(props: { open: boolean, ref?: (api: QueueTracksApi) => void }) {
  let listRef!: HTMLDivElement
  function revealCurrent(options: ScrollIntoViewOptions) {
    // container: nearest 让定位只滚动队列；当前 DOM 类型库尚未收录此选项。
    const scrollOptions = { ...options, inline: 'nearest' as const, container: 'nearest' }
    listRef.querySelector('[aria-current="true"]')?.scrollIntoView(scrollOptions)
  }
  props.ref?.({ scrollToCurrent: () => {
    revealCurrent({
      block: 'center',
      behavior: window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth',
    })
  } })
  createEffect(() => [props.open, currentIndex(), playQueue()] as const, ([open]) => {
    if (open)
      untrack(() => revealCurrent({ block: 'start' }))
  })
  async function play(index: number) {
    if (currentIndex() === index) {
      await setPlaying(!playing())
      return
    }
    await setCurrentIndex(index)
    await setPlaying(true)
  }
  return (
    <div ref={listRef} class="min-h-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-contain p-2 scroll-pt-2" aria-label="队列歌曲">
      <Show when={playQueue().length} fallback={<p class="empty text-sm text-muted-foreground">队列还是空的</p>}>
        <div class="grid grid-cols-1 gap-1"><For each={playQueue()}>{(song, index) => (
          <ContextMenu label="队列歌曲操作" getItems={() => [{
            id: 'remove-from-queue',
            label: '从队列中移除',
            icon: 'i-lucide:trash-2',
            destructive: true,
            disabled: !canControlRoom(),
            onSelect: () => removeFromPlayQueue(index()),
          }, ...(song.provider === 'bili' ? [{ id: 'select-parts', label: '选择分 P', icon: 'i-lucide:list-video', disabled: !canControlRoom(), onSelect: () => { void openBiliParts(song) } }] : [])]}>{trigger => (
            <div {...trigger} class={clsx('group flex min-w-0 h-12.5 content-visibility-auto items-center gap-2 rounded-lg px-2 py-1.5 transition-colors hover:bg-accent/60', currentIndex() === index() && 'bg-accent')} aria-current={currentIndex() === index() ? 'true' : undefined}>
              <button class="flex flex-1 min-w-0 items-center gap-3 rounded-md text-left outline-none focus-visible:ring-2 focus-visible:ring-ring" disabled={!canControlRoom() && currentIndex() !== index()} aria-label={`播放 ${song.title}`} onClick={() => play(index())}>
                <span class="relative size-9 shrink-0 overflow-hidden rounded-md bg-muted grid place-items-center">
                  <Show when={song.coverUrl} fallback={<span class="i-lucide:music-2 text-5 text-muted-foreground" />}>
                    <img src={song.coverUrl} alt="" loading="lazy" referrerpolicy="no-referrer" class="size-full object-cover" />
                  </Show>
                  <Show when={currentIndex() === index()}><span class="absolute inset-0 grid place-items-center bg-black/35 text-white"><span class={clsx('text-5', playing() ? 'i-lucide:audio-lines' : 'i-lucide:play')} /></span></Show>
                </span>
                <span class="min-w-0 flex-1"><span class="block truncate text-sm font-medium" innerHTML={song.title} /><span class="block truncate text-xs mt-0.5 text-muted-foreground">{song.artist || '未知创作者'}</span></span>
              </button>
              <span class="text-[11px] tabular-nums text-muted-foreground max-[400px]:hidden">{formatTime(song.duration)}</span>
              <button class="ghost-btn size-8 shrink-0 text-muted-foreground hover:text-destructive" disabled={!canControlRoom()} aria-label={`移除 ${song.title}`} onClick={() => removeFromPlayQueue(index())}><span class="i-lucide:x text-3.5" /></button>
            </div>
          )}</ContextMenu>
        )}</For></div>
      </Show>
    </div>
  )
}
