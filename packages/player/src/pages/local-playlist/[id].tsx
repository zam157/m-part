import ProviderImage from '~/components/ProviderImage/ProviderImage'
import { useNavigate, useParams } from '@solidjs/router'
import { createEffect, createSignal, For, Match, Show, Switch } from 'solid-js'
import ErrorMessage from '~/components/ErrorMessage/ErrorMessage'
import MusicContextMenu from '~/components/MusicContextMenu/MusicContextMenu'
import { localPlaylists, setLocalPlaylistDialog } from '~/composables/local-playlists'
import { setPlaylistView } from '~/composables/playlists'
import { addToPlayQueue, addTracksToPlayQueue, setPlayQueue } from '~/composables/player'
import { canControlRoom } from '~/composables/player-context'
import { formatTime } from '~/components/MusicPlayer/components/player-controls'
import { errorMessage } from '~/utils/index'
import type { MusicInfo } from '@m-part/music/types/music-info'

export default function LocalPlaylistPage() {
  const params = useParams<{ id: string }>()
  const navigate = useNavigate()
  const state = localPlaylists.state
  const playlist = () => state().items.find(item => item.id === params.id)
  const [error, setError] = createSignal('')
  createEffect(() => params.id, () => { setError(''); void localPlaylists.load(true) })
  function back() { setPlaylistView('local'); navigate('/playlists') }
  async function remove(music: MusicInfo) {
    const id = params.id
    setError('')
    try { await localPlaylists.change(id, value => ({ ...value, tracks: value.tracks.filter(track => track.provider !== music.provider || track.id !== music.id) })) }
    catch (failure) { setError(errorMessage(failure)) }
  }
  return (
    <div class="flex-1 min-w-0 overflow-auto px-9 py-8 max-[760px]:px-4.5 max-[760px]:py-6">
      <button class="ghost-btn px-2 mb-5" onClick={back}><span class="i-lucide:arrow-left text-4" />我的歌单</button>
      <Switch>
        <Match when={state().error}><ErrorMessage message={state().error} onRetry={() => localPlaylists.load(true)} /></Match>
        <Match when={!state().loaded}><div class="empty min-h-50" role="status">正在读取本地歌单…</div></Match>
        <Match when={playlist()}>
          <header class="flex items-center gap-5 mb-6">
            <Show when={playlist()?.tracks[0]?.coverUrl} fallback={<div class="size-24 shrink-0 rounded-lg bg-muted grid place-items-center"><span class="i-lucide:library text-9 text-muted-foreground" /></div>}>
              <ProviderImage provider={playlist()?.tracks[0]?.provider} usage="detail" src={playlist()?.tracks[0]?.coverUrl} alt="" referrerpolicy="no-referrer" class="size-24 shrink-0 rounded-lg object-cover" />
            </Show>
            <div class="min-w-0"><h1 class="text-6 font-semibold break-words">{playlist()?.title}</h1><p class="page-description">本地歌单 · {playlist()?.tracks.length} 首</p></div>
          </header>
          <div class="flex gap-3 mb-5 flex-wrap">
            <button class="btn h-9 px-3" disabled={!playlist()?.tracks.length || !canControlRoom() || state().loading} onClick={() => { const tracks = playlist()?.tracks; if (tracks?.length) void setPlayQueue(tracks) }}><span class="i-lucide:play text-4" />一键播放</button>
            <button class="border-btn h-9 px-3" disabled={!playlist()?.tracks.length || !canControlRoom() || state().loading} onClick={() => { const tracks = playlist()?.tracks; if (tracks?.length) void addTracksToPlayQueue(tracks, 'next') }}><span class="i-lucide:list-plus text-4" />添加至播放列表</button>
            <button class="border-btn h-9 px-3" disabled={state().loading} onClick={() => { const value = playlist(); if (value) setLocalPlaylistDialog({ kind: 'rename', id: value.id, title: value.title }) }}>重命名</button>
            <button class="ghost-btn h-9 px-3 text-destructive" disabled={state().loading} onClick={() => { const value = playlist(); if (value) setLocalPlaylistDialog({ kind: 'delete', id: value.id, title: value.title }) }}>删除歌单</button>
          </div>
          <Show when={error()}><p class="text-sm text-destructive mb-4" role="alert">{error()}</p></Show>
          <Show when={playlist()?.tracks.length} fallback={<div class="empty min-h-50 text-muted-foreground"><p>歌单还没有歌曲</p><p class="text-xs">在首页或搜索结果中右键点击音乐卡片，添加到这个歌单。</p></div>}>
            <div class="flex flex-col gap-1">
              <For each={playlist()?.tracks ?? []}>{music => (
                <div class="flex items-center gap-2 min-h-16 content-visibility-auto">
                  <MusicContextMenu music={music}>{trigger => (
                    <button {...trigger} class="ghost-btn h-auto min-h-16 p-2 justify-start text-left flex-1 min-w-0" disabled={!canControlRoom()} aria-label={`播放 ${music.title}`} onClick={() => void addToPlayQueue(music)}>
                      <Show when={music.coverUrl} fallback={<span class="size-12 shrink-0 bg-muted rounded-md grid place-items-center"><span class="i-lucide:music text-5" /></span>}>
                        <ProviderImage provider={music.provider} usage="list" src={music.coverUrl} alt="" loading="lazy" referrerpolicy="no-referrer" class="size-12 shrink-0 rounded-md object-cover" />
                      </Show>
                      <span class="flex flex-col min-w-0 flex-1 gap-1"><span class="text-sm font-medium truncate">{music.title}</span><span class="text-xs text-muted-foreground truncate">{music.artist}</span></span>
                      <span class="text-xs text-muted-foreground shrink-0">{formatTime(music.duration)}</span>
                    </button>
                  )}</MusicContextMenu>
                  <button class="ghost-btn size-9 shrink-0 text-muted-foreground" aria-label={`从歌单移除 ${music.title}`} disabled={state().loading} onClick={() => void remove(music)}><span class="i-lucide:x text-4" /></button>
                </div>
              )}</For>
            </div>
          </Show>
        </Match>
        <Match when={state().loaded}><div class="empty min-h-50 text-muted-foreground">这个本地歌单不存在或已被删除</div></Match>
      </Switch>
    </div>
  )
}
