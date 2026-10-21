import { clsx } from 'cn/lite'
import { createEffect, createMemo, createSignal, For, Show, untrack } from 'solid-js'
import ContextMenu from '~/components/ContextMenu/ContextMenu'
import { currentIndex, playing, playQueue, removeFromPlayQueue, setCurrentIndex, setPlaying } from '~/composables/player'
import { formatTime } from '~/components/MusicPlayer/components/player-controls'

export default function QueueTracks(props: { open: boolean }) {
  let listRef!: HTMLDivElement
  const [reach, setReach] = createSignal(30)
  // 队列保持添加顺序；随机顺序仅用于切歌，不重排界面中的歌曲。
  const order = createMemo(() => playQueue().map((_, i) => i))
  const visibleOrder = createMemo(() => {
    const all = order()
    const position = Math.max(0, all.indexOf(currentIndex() ?? 0))
    return all.slice(Math.max(0, position - reach()), position + reach())
  })
  createEffect(() => [props.open, currentIndex(), order()] as const, ([open]) => {
    if (open)
      untrack(() => listRef.querySelector('[aria-current="true"]')?.scrollIntoView({ block: 'start' }))
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
    <div ref={listRef} class="min-h-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-contain p-4 scroll-pt-4" aria-label="队列歌曲">
      <Show when={playQueue().length} fallback={<p class="empty text-sm text-muted-foreground">队列还是空的</p>}>
        <div class="grid grid-cols-1 gap-2"><For each={visibleOrder()}>{index => (
          <ContextMenu label="队列歌曲操作" getItems={() => [{
            id: 'remove-from-queue',
            label: '从队列中移除',
            icon: 'i-lucide:trash-2',
            destructive: true,
            onSelect: () => removeFromPlayQueue(index),
          }]}>{trigger => (
            <div {...trigger} class={clsx('group flex min-w-0 items-center gap-2 rounded-lg px-2 py-2 transition-colors hover:bg-accent/60', currentIndex() === index && 'bg-accent')} aria-current={currentIndex() === index ? 'true' : undefined}>
              <button class="flex flex-1 min-w-0 items-center gap-3 rounded-md text-left outline-none focus-visible:ring-2 focus-visible:ring-ring" aria-label={`播放 ${playQueue()[index]?.title}`} onClick={() => play(index)}>
                <span class="relative size-11 shrink-0 overflow-hidden rounded-md bg-muted grid place-items-center">
                  <Show when={playQueue()[index]?.coverUrl} fallback={<span class="i-lucide:music-2 text-5 text-muted-foreground" />}>
                    <img src={playQueue()[index]!.coverUrl} alt="" loading="lazy" referrerpolicy="no-referrer" class="size-full object-cover" />
                  </Show>
                  <Show when={currentIndex() === index}><span class="absolute inset-0 grid place-items-center bg-black/35 text-white"><span class={clsx('text-5', playing() ? 'i-lucide:audio-lines' : 'i-lucide:play')} /></span></Show>
                </span>
                <span class="min-w-0 flex-1"><span class="block truncate text-sm font-medium" innerHTML={playQueue()[index]?.title} /><span class="block truncate text-xs mt-1 text-muted-foreground">{playQueue()[index]?.artist || '未知创作者'}</span></span>
              </button>
              <span class="text-[11px] tabular-nums text-muted-foreground max-[400px]:hidden">{formatTime(playQueue()[index]?.duration ?? 0)}</span>
              <button class="ghost-btn size-8 shrink-0 text-muted-foreground hover:text-destructive" aria-label={`移除 ${playQueue()[index]?.title}`} onClick={() => removeFromPlayQueue(index)}><span class="i-lucide:x text-3.5" /></button>
            </div>
          )}</ContextMenu>
        )}</For></div>
        <Show when={visibleOrder().length < order().length}>
          <button class="border-btn w-full h-9 mt-3 text-xs" onClick={() => setReach(value => value + 50)}>显示更多歌曲（{visibleOrder().length} / {order().length}）</button>
        </Show>
      </Show>
    </div>
  )
}
