import { createEffect, createSignal, For, Show, untrack } from 'solid-js'
import {
  addMusicToLocalPlaylist, localPlaylistDialog, localPlaylists, setLocalPlaylistDialog,
} from '~/composables/local-playlists'
import { errorMessage } from '~/utils/index'
import Dialog, { DialogBody, DialogFooter, DialogHeader } from '~/components/Dialog/Dialog'

export default function LocalPlaylistDialog() {
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
    if (next) void localPlaylists.load(true)
  })
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
    <Dialog open={!!request()} onClose={close} aria-labelledby="local-playlist-dialog-title">
      <form class="min-h-0 flex flex-col" onSubmit={event => { event.preventDefault(); void save() }}>
        <DialogHeader title={heading()} titleId="local-playlist-dialog-title" closeLabel="关闭本地歌单弹窗" onClose={close} />
        <DialogBody class="grid auto-rows-max content-start gap-3">
          <Show when={request()?.kind === 'add'}>
            <p class="text-sm text-muted-foreground break-words">{musicTitle()}</p>
          </Show>
          <Show when={error() || state().error}>
            <div class="flex flex-wrap items-center gap-2 text-sm text-destructive" role="alert"><span>{error() || state().error}</span><Show when={state().error}><button type="button" class="ghost-btn px-2" disabled={busy() || state().loading} onClick={() => { setError(''); void localPlaylists.load(true) }}>重试</button></Show></div>
          </Show>
          <Show when={message()}><p class="text-sm" role="status">{message()}</p></Show>
          <Show when={adding()}>
            <Show when={state().loading && !state().loaded}><p class="text-sm text-muted-foreground" role="status">正在读取本地歌单…</p></Show>
            <div class="grid gap-1" aria-label="选择本地歌单">
              <For each={state().items}>{playlist => (
                <button type="button" class="ghost-btn w-full h-auto min-h-12 px-3 py-2 justify-between gap-3 text-left" disabled={busy() || state().loading || contains(playlist.id)} onClick={() => void save(playlist.id)}>
                  <span class="min-w-0 flex-1 truncate">{playlist.title}</span><span class="text-xs text-muted-foreground shrink-0">{contains(playlist.id) ? '已添加' : `${playlist.tracks.length} 首`}</span>
                </button>
              )}</For>
            </div>
            <Show when={state().loaded && !state().error && !state().items.length}><p class="text-sm text-muted-foreground">还没有本地歌单，在下方新建并添加这首歌。</p></Show>
          </Show>
          <Show when={!deleting()} fallback={<p class="text-sm break-words">确定删除「{playlistTitle()}」？歌单中的歌曲记录也会被移除，此操作无法撤销。</p>}>
            <label class="grid gap-3 text-sm"><span>{adding() ? '新建歌单' : '歌单名称'}</span>
              <input class="input w-full" aria-label="本地歌单名称" value={title()} onInput={event => setTitle(event.currentTarget.value)} placeholder="输入歌单名称" maxlength="80" disabled={busy()} />
            </label>
          </Show>
        </DialogBody>
        <DialogFooter class="justify-end">
          <button type="button" class="border-btn h-8 px-3" onClick={close}>{adding() ? '完成' : '取消'}</button>
          <button type="submit" class="btn h-8 px-3" disabled={busy() || state().loading || (!deleting() && !title().trim())}>{busy() ? '正在保存…' : deleting() ? '删除歌单' : adding() ? '新建并添加' : request()?.kind === 'rename' ? '保存名称' : '创建歌单'}</button>
        </DialogFooter>
      </form>
    </Dialog>
  )
}
