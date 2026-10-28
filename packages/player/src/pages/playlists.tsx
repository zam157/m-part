import type { PlaylistInfo } from '@m-part/music/types/music-info'
import { useNavigate } from '@solidjs/router'
import { createEffect, For, Match, Show, Switch } from 'solid-js'
import { clsx } from 'cn/lite'
import ErrorMessage from '~/components/ErrorMessage/ErrorMessage'
import PlatformLogin, { platformOptions } from '~/components/PlatformLogin/PlatformLogin'
import Select from '~/components/Select/Select'
import LocalPlaylists from '~/components/LocalPlaylists/LocalPlaylists'
import { loadPlaylists, playlistLibrary, playlistSource, setPlaylistSource, playlistView, setPlaylistView } from '~/composables/playlists'

export default function PlaylistsPage() {
  const navigate = useNavigate()
  const library = () => playlistLibrary()
  createEffect(() => ({ view: playlistView(), source: playlistSource() }), ({ view, source }) => { if (view === 'platform') void loadPlaylists(source) })

  function openPlaylist(playlist: PlaylistInfo) {
    const query = new URLSearchParams({ title: playlist.title, cover: playlist.coverUrl, creator: playlist.creator ?? '' })
    navigate(`/playlist-detail/${playlist.provider}/${playlist.id}?${query}`)
  }

  return (
    <div class="flex-1 min-w-0 overflow-auto px-9 py-8 max-[760px]:px-4.5 max-[760px]:py-6">
      <header class="mb-6"><h1 class="page-title">我的歌单</h1></header>
      <div class="flex gap-2 mb-6" role="group" aria-label="歌单类型">
        <button class={clsx('border-btn h-9 px-3', playlistView() === 'local' && 'bg-muted')} aria-pressed={playlistView() === 'local' ? 'true' : 'false'} onClick={() => setPlaylistView('local')}>本地歌单</button>
        <button class={clsx('border-btn h-9 px-3', playlistView() === 'platform' && 'bg-muted')} aria-pressed={playlistView() === 'platform' ? 'true' : 'false'} onClick={() => setPlaylistView('platform')}>平台歌单</button>
      </div>
      <Show when={playlistView() === 'local'}><LocalPlaylists /></Show>
      <Show when={playlistView() === 'platform'}>
        <div class="flex items-center gap-3 mb-6">
          <Select value={playlistSource()} options={platformOptions} onValueChange={setPlaylistSource} triggerClass="w-30 !h-10" contentStyle="width:anchor-size(width);justify-self:auto;left:anchor(left);" />
          <button class="border-btn px-3 h-10" disabled={library().loading} onClick={() => loadPlaylists(playlistSource(), { refresh: true })}>刷新歌单</button>
          <Show when={library().user}><span class="text-sm text-muted-foreground truncate">{library().user?.name}</span></Show>
        </div>
        <Switch>
          <Match when={library().error}>
            <ErrorMessage message={library().error ?? ''} onRetry={() => loadPlaylists(playlistSource(), { refresh: true })} />
          </Match>
          <Match when={!library().loaded || library().source !== playlistSource()}>
            <div class="empty min-h-60" role="status"><span class="i-lucide:loader-circle text-7 animate-spin" /><span>正在读取歌单…</span></div>
          </Match>
          <Match when={library().loaded && !library().user}>
            <PlatformLogin source={playlistSource()} onRefresh={() => loadPlaylists(playlistSource(), { refresh: true })} />
          </Match>
          <Match when={library().items.length}>
            <div class="grid grid-cols-4 gap-4 max-[1100px]:grid-cols-3 max-[760px]:grid-cols-2">
              <For each={library().items}>{playlist => (
                <button class="card p-3 gap-2 text-left hover:bg-muted transition-colors" aria-label={`打开歌单 ${playlist.title}`} onClick={() => openPlaylist(playlist)}>
                  <Show when={playlist.coverUrl} fallback={<div class="w-full aspect-square rounded-md bg-muted grid place-items-center"><span class="i-lucide:library text-10 text-muted-foreground" /></div>}>
                    <img src={playlist.coverUrl} alt="" loading="lazy" referrerpolicy="no-referrer" class="w-full aspect-square rounded-md object-cover" />
                  </Show>
                  <span class="text-sm font-semibold line-clamp-2 min-h-10">{playlist.title}</span>
                  <span class="text-xs text-muted-foreground">{playlist.owned ? '我创建的' : '我收藏的'} · {playlist.totalTracks} 首</span>
                  <span class="text-xs text-muted-foreground truncate w-full">{playlist.creator}</span>
                </button>
              )}</For>
            </div>
          </Match>
          <Match when={library().loaded}><div class="empty min-h-60 text-muted-foreground">还没有收藏歌单</div></Match>
        </Switch>
        <Show when={library().hasMore && !library().error}>
          <div class="flex justify-center mt-6"><button class="border-btn px-4 h-9" disabled={library().loading} onClick={() => loadPlaylists(playlistSource(), { more: true })}>{library().loading ? '正在加载…' : '加载更多歌单'}</button></div>
        </Show>
      </Show>
    </div>
  )
}
