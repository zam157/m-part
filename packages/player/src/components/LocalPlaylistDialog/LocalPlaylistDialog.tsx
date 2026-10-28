import { createEffect, createSignal, For, onCleanup, Show, untrack } from 'solid-js'
import {
  addMusicToLocalPlaylist, localPlaylistDialog, localPlaylists, setLocalPlaylistDialog,
} from '~/composables/local-playlists'
import { errorMessage } from '~/utils/index'

export default function LocalPlaylistDialog() {
  let dialog!: HTMLDialogElement
  const [title, setTitle] = createSignal('')
  const [error, setError] = createSignal('')
  const [message, setMessage] = createSignal('')
  const [busy, setBusy] = createSignal(false)
  const request = localPlaylistDialog
  const state = localPlaylists.state
  const adding = () => request()?.kind === 'add'
  const deleting = () => request()?.kind === 'delete'
  const musicTitle = () => { const current = request(); return current?.kind === 'add' ? current.music.title : '' }
  const playlistTitle = () => { const current = request(); return current?.kind === 'delete' ? current.title : '' }
  const heading = () => adding() ? '添加到本地歌单' : deleting() ? '删除本地歌单' : request()?.kind === 'rename' ? '重命名歌单' : '新建本地歌单'
  function close() { setLocalPlaylistDialog(null) }
  createEffect(request, (next) => {
    setTitle(next?.kind === 'rename' ? next.title : '')
    setError(''); setMessage(''); setBusy(false)
    if (next) {
      if (!dialog.open) dialog.showModal()
      void localPlaylists.load(true)
    }
    else if (dialog.open) dialog.close()
  })
  onCleanup(() => { if (dialog.open) dialog.close() })
  async function save(id?: string) {
    const current = request()
    if (!current || busy()) return
    setBusy(true); setError(''); setMessage('')
    try {
      if (current.kind === 'add' && id) {
        await addMusicToLocalPlaylist(id, current.music)
        if (untrack(request) === current) setMessage('已添加到本地歌单')
      }
      else if (current.kind === 'rename') {
        const name = title()
        await localPlaylists.change(current.id, playlist => ({ ...playlist, title: name }))
        if (untrack(request) === current) close()
      }
      else if (current.kind === 'delete') {
        await localPlaylists.change(current.id, () => undefined)
        if (untrack(request) === current) close()
      }
      else {
        await localPlaylists.create(title(), current.kind === 'add' ? [current.music] : [])
        if (untrack(request) === current) {
          if (current.kind === 'add') { setTitle(''); setMessage('已新建歌单并添加歌曲') }
          else close()
        }
      }
    }
    catch (failure) { if (untrack(request) === current) setError(errorMessage(failure)) }
    finally { if (untrack(request) === current) setBusy(false) }
  }
  const contains = (id: string) => {
    const current = request()
    return current?.kind === 'add' && state().items.find(playlist => playlist.id === id)?.tracks.some(track => track.provider === current.music.provider && track.id === current.music.id)
  }
  return (
    <dialog ref={dialog} aria-labelledby="local-playlist-dialog-title" class="m-auto w-[min(28rem,calc(100vw-2rem))] max-w-none max-h-[calc(100svh-2rem)] overflow-y-auto rounded-2xl border border-border bg-background text-foreground p-5 shadow-xl backdrop:bg-black/50" onCancel={close} onClose={() => { if (!dialog.open) close() }}>
      <header class="flex items-center justify-between gap-3 mb-4">
        <h2 id="local-playlist-dialog-title" class="text-lg font-semibold">{heading()}</h2>
        <button type="button" class="ghost-btn size-8 shrink-0" aria-label="关闭本地歌单弹窗" onClick={close}><span class="i-lucide:x text-5" /></button>
      </header>
      <Show when={request()?.kind === 'add'}>
        <p class="text-sm text-muted-foreground break-words mb-3">{musicTitle()}</p>
      </Show>
      <Show when={error() || state().error}>
        <div class="text-sm text-destructive mb-3" role="alert">{error() || state().error}<Show when={state().error}><button type="button" class="ghost-btn px-2 ml-2" disabled={busy() || state().loading} onClick={() => { setError(''); void localPlaylists.load(true) }}>重试</button></Show></div>
      </Show>
      <Show when={message()}><p class="text-sm mb-3" role="status">{message()}</p></Show>
      <Show when={adding()}>
        <Show when={state().loading && !state().loaded}><p class="text-sm text-muted-foreground mb-3" role="status">正在读取本地歌单…</p></Show>
        <div class="space-y-1 max-h-60 overflow-y-auto mb-4" aria-label="选择本地歌单">
          <For each={state().items}>{playlist => (
            <button type="button" class="ghost-btn w-full h-auto min-h-12 px-3 py-2 justify-between gap-3 text-left" disabled={busy() || state().loading || contains(playlist.id)} onClick={() => void save(playlist.id)}>
              <span class="min-w-0 flex-1 truncate">{playlist.title}</span><span class="text-xs text-muted-foreground shrink-0">{contains(playlist.id) ? '已添加' : `${playlist.tracks.length} 首`}</span>
            </button>
          )}</For>
        </div>
        <Show when={state().loaded && !state().error && !state().items.length}><p class="text-sm text-muted-foreground mb-4">还没有本地歌单，在下方新建并添加这首歌。</p></Show>
      </Show>
      <form class="space-y-3" onSubmit={event => { event.preventDefault(); void save() }}>
        <Show when={!deleting()} fallback={<p class="text-sm break-words">确定删除「{playlistTitle()}」？歌单中的歌曲记录也会被移除，此操作无法撤销。</p>}>
          <label class="block text-sm">{adding() ? '新建歌单' : '歌单名称'}
            <input class="input w-full mt-2" aria-label="本地歌单名称" value={title()} onInput={event => setTitle(event.currentTarget.value)} placeholder="输入歌单名称" maxlength="80" disabled={busy()} />
          </label>
        </Show>
        <div class="flex justify-end gap-2 flex-wrap">
          <button type="button" class="border-btn h-9 px-3" onClick={close}>{adding() ? '完成' : '取消'}</button>
          <button type="submit" class="btn h-9 px-3" disabled={busy() || state().loading || (!deleting() && !title().trim())}>{busy() ? '正在保存…' : deleting() ? '删除歌单' : adding() ? '新建并添加' : request()?.kind === 'rename' ? '保存名称' : '创建歌单'}</button>
        </div>
      </form>
    </dialog>
  )
}
