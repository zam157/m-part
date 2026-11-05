import { createEffect, createSignal, For, onCleanup, Show } from 'solid-js'
import { trackParts, cancelTrackParts, confirmTrackParts, retryTrackParts } from '~/composables/track-parts'
import { getTrackPartsLabel } from '~/utils/track-parts'
import { canControlRoom } from '~/composables/player-context'
import { formatTime } from '~/components/MusicPlayer/components/player-controls'
import Dialog, { DialogBody, DialogFooter, DialogHeader } from '~/components/Dialog/Dialog'

export default function TrackPartPicker() {
  const [open, setOpen] = createSignal(false)
  const [query, setQuery] = createSignal('')
  const [selected, setSelected] = createSignal<Set<string>>(new Set())
  const label = () => getTrackPartsLabel(trackParts()?.music)
  const filtered = () => (trackParts()?.tracks ?? []).filter(track => track.title.toLocaleLowerCase().includes(query().trim().toLocaleLowerCase()))
  const chosen = () => (trackParts()?.tracks ?? []).filter(track => selected().has(track.id))
  const isDownload = () => trackParts()?.action === 'download'
  const disabled = () => (!isDownload() && !canControlRoom()) || !!trackParts()?.loading
  createEffect(() => trackParts()?.requestId, () => {
    setQuery(''); setSelected(new Set<string>())
  })
  createEffect(() => ({ id: trackParts()?.requestId, loading: trackParts()?.loading }), ({ id, loading }) => {
    // Wait for the result: a single part resolves directly without opening a modal.
    // Keep an already open dialog visible while retrying a failed request.
    if (id === undefined) setOpen(false)
    else if (!loading) setOpen(true)
  })
  onCleanup(cancelTrackParts)
  function toggle(id: string) {
    const next = new Set(selected())
    if (next.has(id)) next.delete(id)
    else next.add(id)
    setSelected(next)
  }
  return (
    <Dialog open={open()} onClose={cancelTrackParts} size="lg" aria-labelledby="track-parts-title" aria-describedby="track-parts-description">
      <DialogHeader title={`选择${label()}`} titleId="track-parts-title" description={trackParts()?.music.title} descriptionId="track-parts-description" closeLabel={`关闭${label()}选择器`} onClose={cancelTrackParts} />
      <Show when={trackParts()?.error}>
        <DialogBody><div class="grid gap-3" role="alert"><p class="text-sm text-destructive">{trackParts()?.error}</p><button class="border-btn h-8 px-3 justify-self-start" onClick={() => void retryTrackParts()}>重新加载{label()}</button></div></DialogBody>
      </Show>
      <Show when={trackParts()?.loading}><DialogBody><p class="text-sm text-muted-foreground" role="status">正在读取{label()}…</p></DialogBody></Show>
      <Show when={!trackParts()?.loading && !trackParts()?.error}>
        <div class="px-4 pb-3 flex gap-2 items-center shrink-0 flex-wrap">
          <input class="input flex-1 min-w-24" aria-label={`搜索${label()}`} placeholder={`搜索${label()}标题或序号`} value={query()} onInput={event => setQuery(event.currentTarget.value)} />
          <button class="ghost-btn px-2" disabled={disabled()} onClick={() => setSelected(new Set(trackParts()?.tracks.map(track => track.id)))}>全选</button>
          <button class="ghost-btn px-2" disabled={disabled()} onClick={() => setSelected(new Set())}>清空</button>
        </div>
        <DialogBody class="overscroll-contain" aria-label={`${label()}列表`}>
          <div class="grid auto-rows-max content-start gap-1">
            <For each={filtered()}>{track => (
              <div class="flex gap-3 items-center rounded-lg p-2 hover:bg-muted min-h-14 content-visibility-auto">
                <input type="checkbox" class="size-4 shrink-0" aria-label={`选择 ${track.title}`} checked={selected().has(track.id)} disabled={disabled()} onChange={() => toggle(track.id)} />
                <button class="min-w-0 flex-1 text-left rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring" disabled={disabled()} aria-label={`${isDownload() ? '下载' : trackParts()?.action === 'next' ? '下一首' : '播放'} ${track.title}`} onClick={() => confirmTrackParts([track], trackParts()?.action ?? 'play')}>
                  <span class="block text-sm line-clamp-2 break-words">{track.title}</span><span class="text-xs text-muted-foreground">{formatTime(track.duration)}</span>
                </button>
              </div>
            )}</For>
            <Show when={!filtered().length}><p class="p-4 text-sm text-muted-foreground">没有匹配的{label()}</p></Show>
          </div>
        </DialogBody>
        <DialogFooter>
          <span class="flex-1 text-xs text-muted-foreground">已选 {chosen().length} / {trackParts()?.tracks.length} 项</span>
          <Show when={!isDownload()}><button class="border-btn h-8 px-3" disabled={disabled() || !chosen().length} onClick={() => confirmTrackParts(chosen(), 'append')}>加入队列</button></Show>
          <button class="btn h-8 px-3" disabled={disabled() || !chosen().length} onClick={() => confirmTrackParts(chosen(), trackParts()?.action ?? 'play')}>{isDownload() ? '下载所选' : trackParts()?.action === 'next' ? '设为下一首' : '播放所选'}</button>
          <Show when={!isDownload() && !canControlRoom()}><p class="text-xs text-muted-foreground w-full">房主或管理员恢复控制权限后才能添加所选曲目。</p></Show>
        </DialogFooter>
      </Show>
    </Dialog>
  )
}
