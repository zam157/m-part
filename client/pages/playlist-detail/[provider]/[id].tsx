import type { ProviderName } from '#shared/types/provider'
import { useNavigate, useParams, useSearchParams } from '@solidjs/router'
import { For, Match, onCleanup, Show, Switch, untrack } from 'solid-js'
import ErrorMessage from '~/components/ErrorMessage/ErrorMessage'
import MusicContextMenu from '~/components/MusicContextMenu/MusicContextMenu'
import PlatformLogin from '~/components/PlatformLogin/PlatformLogin'
import { createPlaylistTracks } from '~/composables/playlist-tracks'
import { addToPlayQueue, setPlayQueue } from '~/composables/player'

export default function PlaylistDetailPage() {
  const params = useParams<{ provider: string, id: string }>()
  const route = () => params.id && (params.provider === 'bili' || params.provider === 'netease') ? { source: params.provider as ProviderName, id: params.id } : null
  return (
    <Show when={route()} keyed fallback={<div class="empty">找不到这个音源的歌单</div>}>
      {value => <PlaylistDetailView source={value.source} id={value.id} />}
    </Show>
  )
}

function PlaylistDetailView(props: { source: ProviderName, id: string }) {
  const navigate = useNavigate()
  const [query] = untrack(() => useSearchParams())
  const metadata = untrack(() => ({
    title: typeof query.title === 'string' ? query.title : '歌单',
    creator: typeof query.creator === 'string' ? query.creator : '',
    cover: typeof query.cover === 'string' ? query.cover : '',
    fromSearch: query.from === 'search',
  }))
  const tracks = createPlaylistTracks(props.source, props.id)
  const state = tracks.state
  let disposed = false
  let playingAll = false
  let retryPlayAll = false
  onCleanup(() => { disposed = true; tracks.dispose() })
  void tracks.load()

  async function playPlaylist() {
    if (playingAll)
      return
    playingAll = true
    retryPlayAll = true
    try {
      const items = await tracks.loadAll()
      // 完整读取成功后才替换队列；失败或离开页面不改变当前播放。
      if (!disposed && items?.length)
        await setPlayQueue(items)
    }
    finally {
      playingAll = false
    }
  }

  return (
    <div class="flex-1 min-w-0 overflow-auto px-9 py-8 max-[760px]:px-4.5 max-[760px]:py-6">
      <button class="ghost-btn px-2 mb-5" onClick={() => navigate(metadata.fromSearch ? '/search' : '/playlists')}><span class="i-lucide:arrow-left text-4" />{metadata.fromSearch ? '返回搜索' : '我的歌单'}</button>
      <header class="flex items-center gap-5 mb-6">
        <Show when={metadata.cover} fallback={<div class="size-24 shrink-0 rounded-lg bg-muted grid place-items-center"><span class="i-lucide:library text-9 text-muted-foreground" /></div>}>
          <img src={metadata.cover} alt="" referrerpolicy="no-referrer" class="size-24 shrink-0 rounded-lg object-cover" />
        </Show>
        <div class="min-w-0"><h1 class="text-6 font-semibold break-words">{metadata.title}</h1><p class="page-description">{metadata.creator}</p><span class="text-xs text-muted-foreground">已加载 {state().items.length} 首</span></div>
      </header>
      <div class="flex gap-3 mb-5 flex-wrap">
        <button class="btn h-9 px-3" disabled={tracks.loadingAll() || state().loading || state().loginRequired || !state().items.length && !state().hasMore} onClick={playPlaylist}><span class={tracks.loadingAll() ? 'i-lucide:loader-circle text-4 animate-spin' : 'i-lucide:play text-4'} />一键播放</button>
        <button class="border-btn h-9 px-3" disabled={state().loading || tracks.loadingAll()} onClick={() => { retryPlayAll = false; void tracks.load(true) }}>刷新曲目</button>
      </div>
      <Show when={tracks.loadingAll()}><p class="text-sm text-muted-foreground mb-4" role="status">正在读取整个歌单，已读取 {state().items.length} 首…</p></Show>
      <Switch>
        <Match when={state().error}><ErrorMessage message={state().error ?? ''} onRetry={() => retryPlayAll ? playPlaylist() : tracks.load()} /></Match>
        <Match when={state().loginRequired}><PlatformLogin source={props.source} onRefresh={() => tracks.load(true)} /></Match>
        <Match when={state().loading && !state().items.length}><div class="empty min-h-50" role="status"><span class="i-lucide:loader-circle text-7 animate-spin" /><span>正在读取曲目…</span></div></Match>
        <Match when={state().items.length}>
          <div class="flex flex-col gap-1">
            <For each={state().items}>{music => (
              <MusicContextMenu music={music} disabled={tracks.loadingAll()}>{trigger => (
                <button {...trigger} class="ghost-btn h-auto min-h-16 p-2 justify-start text-left w-full" disabled={tracks.loadingAll()} aria-label={`播放 ${music.title}`} onClick={() => addToPlayQueue(music)}>
                  <Show when={music.coverUrl} fallback={<span class="size-12 shrink-0 bg-muted rounded-md grid place-items-center"><span class="i-lucide:music text-5" /></span>}>
                    <img src={music.coverUrl} alt="" loading="lazy" referrerpolicy="no-referrer" class="size-12 shrink-0 rounded-md object-cover" />
                  </Show>
                  <span class="flex flex-col min-w-0 flex-1 gap-1"><span class="text-sm font-medium truncate">{music.title}</span><span class="text-xs text-muted-foreground truncate">{music.artist}</span></span>
                  <span class="i-lucide:play text-4 shrink-0 mx-2" />
                </button>
              )}</MusicContextMenu>
            )}</For>
          </div>
        </Match>
        <Match when={!state().loading}><div class="empty min-h-50 text-muted-foreground">暂无可播放曲目</div></Match>
      </Switch>
      <Show when={state().hasMore && !state().error && !state().loginRequired}>
        <div class="flex justify-center mt-5"><button class="border-btn px-4 h-9" disabled={state().loading || tracks.loadingAll()} onClick={() => { retryPlayAll = false; void tracks.load() }}>{state().loading ? '正在加载…' : '加载更多歌曲'}</button></div>
      </Show>
    </div>
  )
}
