import { useNavigate } from '@solidjs/router'
import { createEffect, For, Match, Show, Switch } from 'solid-js'
import ErrorMessage from '~/components/ErrorMessage/ErrorMessage'
import { localPlaylists, setLocalPlaylistDialog } from '~/composables/local-playlists'

export default function LocalPlaylists() {
  const navigate = useNavigate()
  const state = localPlaylists.state
  createEffect(() => true, () => { void localPlaylists.load(true) })
  return (
    <section aria-label="本地歌单">
      <div class="flex items-center justify-between gap-3 flex-wrap mb-5">
        <p class="text-sm text-muted-foreground">保存在当前浏览器，可收集不同音源的歌曲。</p>
        <button class="btn h-9 px-3" onClick={() => setLocalPlaylistDialog({ kind: 'create' })}><span class="i-lucide:plus text-4" />新建歌单</button>
      </div>
      <Switch>
        <Match when={state().error}><ErrorMessage message={state().error} onRetry={() => localPlaylists.load(true)} /></Match>
        <Match when={!state().loaded}><div class="empty min-h-60" role="status">正在读取本地歌单…</div></Match>
        <Match when={state().items.length}>
          <div class="grid grid-cols-4 gap-4 max-[1100px]:grid-cols-3 max-[760px]:grid-cols-2">
            <For each={state().items}>{playlist => (
              <button class="card p-3 gap-2 text-left hover:bg-muted transition-colors" aria-label={`打开本地歌单 ${playlist.title}`} onClick={() => navigate(`/local-playlist/${encodeURIComponent(playlist.id)}`)}>
                <Show when={playlist.tracks[0]?.coverUrl} fallback={<div class="w-full aspect-square rounded-md bg-muted grid place-items-center"><span class="i-lucide:library text-10 text-muted-foreground" /></div>}>
                  <img src={playlist.tracks[0]?.coverUrl} alt="" loading="lazy" referrerpolicy="no-referrer" class="w-full aspect-square rounded-md object-cover" />
                </Show>
                <span class="text-sm font-semibold line-clamp-2 min-h-10 break-words">{playlist.title}</span>
                <span class="text-xs text-muted-foreground">本地歌单 · {playlist.tracks.length} 首</span>
              </button>
            )}</For>
          </div>
        </Match>
        <Match when={state().loaded}><div class="empty min-h-60 text-muted-foreground"><span class="i-lucide:library text-8" /><p>还没有本地歌单</p><p class="text-xs">新建歌单后，可通过音乐卡片的右键菜单添加歌曲。</p></div></Match>
      </Switch>
    </section>
  )
}
