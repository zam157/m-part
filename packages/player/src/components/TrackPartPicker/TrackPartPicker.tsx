import { createEffect, createSignal, For, onCleanup, Show } from 'solid-js'
import { trackParts, cancelTrackParts, confirmTrackParts, retryTrackParts } from '~/composables/track-parts'
import { getTrackPartsLabel } from '~/utils/track-parts'
import { canControlRoom } from '~/composables/player-context'
import { formatTime } from '~/components/MusicPlayer/components/player-controls'

export default function TrackPartPicker() {
  let dialog!: HTMLDialogElement
  const [query, setQuery] = createSignal('')
  const [selected, setSelected] = createSignal<Set<string>>(new Set())
  const label = () => getTrackPartsLabel(trackParts()?.music)
  const filtered = () => (trackParts()?.tracks ?? []).filter(track => track.title.toLocaleLowerCase().includes(query().trim().toLocaleLowerCase()))
  const chosen = () => (trackParts()?.tracks ?? []).filter(track => selected().has(track.id))
  const disabled = () => !canControlRoom() || !!trackParts()?.loading
  createEffect(() => trackParts()?.requestId, (id) => {
    setQuery(''); setSelected(new Set<string>())
    if (id !== undefined && !dialog.open) dialog.showModal()
    if (id === undefined && dialog.open) dialog.close()
  })
  onCleanup(cancelTrackParts)
  function toggle(id: string) {
    const next = new Set(selected())
    if (next.has(id)) next.delete(id)
    else next.add(id)
    setSelected(next)
  }
  return (
    <dialog ref={dialog} aria-labelledby="track-parts-title" class="m-auto w-[min(42rem,calc(100vw-2rem))] max-w-none max-h-[calc(100svh-2rem)] rounded-2xl border border-border bg-background text-foreground p-0 shadow-xl backdrop:bg-black/50" onCancel={() => cancelTrackParts()} onClose={() => { if (!dialog.open) cancelTrackParts() }}>
      <div class="flex flex-col max-h-[calc(100svh-2rem)] min-h-0">
        <header class="flex items-center justify-between gap-3 border-b border-border p-4 shrink-0">
          <div class="min-w-0"><h2 id="track-parts-title" class="text-lg font-semibold">选择{label()}</h2><p class="text-xs text-muted-foreground truncate mt-1">{trackParts()?.music.title}</p></div>
          <button class="ghost-btn size-9 shrink-0" aria-label={`关闭${label()}选择器`} onClick={cancelTrackParts}><span class="i-lucide:x text-5" /></button>
        </header>
        <Show when={trackParts()?.error}>
          <div class="p-6 space-y-3" role="alert"><p class="text-sm text-destructive">{trackParts()?.error}</p><button class="border-btn h-9 px-3" onClick={() => void retryTrackParts()}>重新加载{label()}</button></div>
        </Show>
        <Show when={trackParts()?.loading}><p class="p-8 text-sm text-muted-foreground" role="status">正在读取{label()}…</p></Show>
        <Show when={!trackParts()?.loading && !trackParts()?.error}>
          <div class="p-4 flex gap-2 items-center shrink-0 flex-wrap">
            <input class="input h-9 flex-1 min-w-24" aria-label={`搜索${label()}`} placeholder={`搜索${label()}标题或序号`} value={query()} onInput={event => setQuery(event.currentTarget.value)} />
            <button class="ghost-btn h-9 px-2" disabled={disabled()} onClick={() => setSelected(new Set(trackParts()?.tracks.map(track => track.id)))}>全选</button>
            <button class="ghost-btn h-9 px-2" disabled={disabled()} onClick={() => setSelected(new Set())}>清空</button>
          </div>
          <div class="min-h-0 overflow-y-auto overscroll-contain px-4 space-y-1" aria-label={`${label()}列表`}>
            <For each={filtered()}>{track => (
              <div class="flex gap-3 items-center rounded-lg p-2 hover:bg-muted min-h-14 content-visibility-auto">
                <input type="checkbox" class="size-4 shrink-0" aria-label={`选择 ${track.title}`} checked={selected().has(track.id)} disabled={disabled()} onChange={() => toggle(track.id)} />
                <button class="min-w-0 flex-1 text-left rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring" disabled={disabled()} aria-label={`${trackParts()?.action === 'next' ? '下一首' : '播放'} ${track.title}`} onClick={() => confirmTrackParts([track], trackParts()?.action ?? 'play')}>
                  <span class="block text-sm line-clamp-2 break-words">{track.title}</span><span class="text-xs text-muted-foreground">{formatTime(track.duration)}</span>
                </button>
              </div>
            )}</For>
            <Show when={!filtered().length}><p class="p-6 text-sm text-muted-foreground">没有匹配的{label()}</p></Show>
          </div>
          <footer class="border-t border-border p-4 mt-3 flex gap-2 items-center flex-wrap shrink-0">
            <span class="text-xs text-muted-foreground mr-auto">已选 {chosen().length} / {trackParts()?.tracks.length} 项</span>
            <button class="border-btn h-9 px-3" disabled={disabled() || !chosen().length} onClick={() => confirmTrackParts(chosen(), 'append')}>加入队列</button>
            <button class="btn h-9 px-3" disabled={disabled() || !chosen().length} onClick={() => confirmTrackParts(chosen(), trackParts()?.action ?? 'play')}>{trackParts()?.action === 'next' ? '设为下一首' : '播放所选'}</button>
            <Show when={!canControlRoom()}><p class="text-xs text-muted-foreground w-full">房主或管理员恢复控制权限后才能添加所选曲目。</p></Show>
          </footer>
        </Show>
      </div>
    </dialog>
  )
}
