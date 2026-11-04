import ProviderImage from '~/components/ProviderImage/ProviderImage'
import type { AlbumInfo, ArtistInfo, PlaylistInfo } from '@m-part/music/types/music-info'
import { useNavigate } from '@solidjs/router'
import { For, Match, Show, Switch } from 'solid-js'
import ErrorMessage from '~/components/ErrorMessage/ErrorMessage'
import MusicContextMenu from '~/components/MusicContextMenu/MusicContextMenu'
import Pagination from '~/components/Pagination/Pagination'
import Select from '~/components/Select/Select'
import { addToPlayQueue } from '~/composables/player'
import {
  albumResults,
  artistResults,
  availableTypeOptions,
  currentResults,
  handleSearch,
  hasSearched,
  keyword,
  musicResults,
  pagination,
  playlistResults,
  searching,
  searchType,
  searchError,
  selectedSource,
  selectedType,
  setKeyword,
  setSelectedSource,
  setSelectedType,
  sourceOptions,
} from '~/composables/search'

const searchSelectClass = 'w-full !h-full !rounded-none !border-0 !shadow-none !bg-transparent !gap-1.5 !ps-2.5 !pe-1 focus-visible:!ring-0'

export default function SearchPage() {
  const navigate = useNavigate()

  function handleArtistCardClick(artist: ArtistInfo) {
    // 跳转到歌手详情页
    navigate(`/artist-detail/${artist.provider}/${artist.id}`)
  }

  function handleAlbumCardClick(album: AlbumInfo) {
    const query = new URLSearchParams({ title: album.title, artist: album.artist, cover: album.coverUrl })
    navigate(`/album-detail/${album.provider}/${album.id}?${query}`)
  }

  function handlePlaylistCardClick(playlist: PlaylistInfo) {
    const query = new URLSearchParams({ title: playlist.title, creator: playlist.creator ?? '', cover: playlist.coverUrl, from: 'search' })
    navigate(`/playlist-detail/${playlist.provider}/${playlist.id}?${query}`)
  }

  return (
    <div class="flex-1 min-w-0 flex flex-col gap-2 px-9 pt-8 pb-5 max-[760px]:px-4.5 max-[760px]:py-6">
      <header class="pb-6"><h1 class="page-title">搜索</h1><p class="page-description">搜索歌曲、创作者、专辑和公开歌单</p></header>
      {/*
        搜索栏与结果网格左缘对齐，最大宽度 800px。
        外层统一边框与焦点环，内部仅保留分隔线；窄屏输入框换到下一行。
      */}
      <form
        class="w-full max-w-200 mb-6 p-0 grow-0 shrink-0 flex gap-2 max-[760px]:flex-wrap"
        onSubmit={(event) => {
          event.preventDefault()
          handleSearch(1, selectedType())
        }}
      >
        <div class="min-w-0 h-8 flex flex-1 items-stretch overflow-hidden rounded-lg border border-input transition-[color,box-shadow] focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50 max-[760px]:grid max-[760px]:grid-cols-2 max-[760px]:h-auto max-[760px]:w-full">
          <div class="flex w-20 shrink-0 border-e border-input max-[760px]:w-auto max-[760px]:h-8">
            <Select
              value={selectedSource()}
              onValueChange={setSelectedSource}
              placeholder="音源"
              aria-label="搜索音源"
              options={sourceOptions}
              alignItemWithTrigger={false}
              triggerClass={searchSelectClass}
            />
          </div>
          <div class="flex w-20 shrink-0 border-e border-input max-[760px]:border-e-0 max-[760px]:w-auto max-[760px]:h-8">
            <Select
              value={selectedType()}
              onValueChange={setSelectedType}
              placeholder="类型"
              aria-label="搜索类型"
              options={availableTypeOptions()}
              alignItemWithTrigger={false}
              triggerClass={searchSelectClass}
            />
          </div>
          <div class="min-w-0 flex flex-1 max-[760px]:col-span-full max-[760px]:h-8 max-[760px]:border-t max-[760px]:border-input">
            <input
              name="search"
              placeholder="搜索歌曲、创作者、歌单…"
              aria-label="搜索关键词"
              class="h-full input !rounded-none !border-0 !bg-transparent focus-visible:!ring-0"
              value={keyword()}
              onInput={event => setKeyword(event.currentTarget.value)}
            />
          </div>
        </div>
        <button class="btn h-8 px-4 max-[760px]:w-full" type="submit" disabled={searching()}>
          <Show when={searching()}>
            <div class="i-lucide:loader-circle text-4 animate-spin" />
          </Show>
          搜索
        </button>
      </form>

      <Show
        when={!searchError() && !searching() && currentResults().length}
        fallback={(
          <Show
            when={searchError()}
            fallback={(
              <div class="empty">
                <div class="grid place-items-center size-16 border border-border rounded-[16px] bg-muted"><span class={searching() ? 'i-lucide:loader-circle text-6 animate-spin' : 'i-lucide:search text-6'} /></div>
                <span class="text-sm/relaxed font-medium">{searching() ? '正在搜索…' : hasSearched() ? '没有找到相关内容' : '输入关键词搜索'}</span>
                <span class="text-xs text-muted-foreground">{searching() ? '请稍候。' : hasSearched() ? '请尝试其他关键词。' : '按 Enter 或点击搜索'}</span>
              </div>
            )}
          >
            <ErrorMessage
              message={searchError() ?? ''}
              onRetry={() => handleSearch(pagination().page, searchType())}
            />
          </Show>
        )}
      >
        {/* 列宽与列数见 uno.config.ts 的 responsive-cols */}
        <div class="py-5.5 px-px border-t border-border min-h-0 flex-1 overflow-auto grid gap-4 responsive-cols max-[760px]:grid-cols-1 grid-auto-rows-max">
          <Switch>
            <Match when={searchType() === 'playlist'}>
              <For each={playlistResults()}>
                {result => (
                  <button class="card gap-2 p-2 text-left hover:bg-muted transition-colors" aria-label={`打开歌单 ${result.title}`} onClick={() => handlePlaylistCardClick(result)}>
                    <Show when={result.coverUrl} fallback={<div class="w-full aspect-ratio-video bg-muted rounded-md grid place-items-center"><span class="i-lucide:library text-8 text-muted-foreground" /></div>}>
                      <ProviderImage provider={result.provider} usage="card" src={result.coverUrl} alt="" loading="lazy" referrerpolicy="no-referrer" class="w-full aspect-ratio-video rounded-md object-cover shrink-0" />
                    </Show>
                    <span class="text-sm/relaxed font-semibold line-clamp-2 h-[calc(2*var(--leading-relaxed)*1em)]">{result.title}</span>
                    <span class="text-xs text-muted-foreground truncate w-full">{result.creator || '未知创建者'} · {result.totalTracks} 首</span>
                  </button>
                )}
              </For>
            </Match>
            <Match when={searchType() === 'music'}>
              <For each={musicResults()}>
                {result => (
                  <MusicContextMenu music={result}>{trigger => (
                    <div
                      {...trigger}
                      class="card gap-2 p-2 cursor-default hover:bg-muted transition-colors"
                      onClick={() => addToPlayQueue(result)}
                    >
                      <div class="flex flex-col gap-2 h-full">
                        <ProviderImage provider={result.provider} usage="card" src={result.coverUrl} alt="cover" referrerpolicy="no-referrer" class="w-full aspect-ratio-video rounded-md object-cover shrink-0" />
                        <span class="text-sm/relaxed font-semibold line-clamp-2 h-[calc(2*var(--leading-relaxed)*1em)]">{result.title}</span>
                        <span class="text-xs text-muted-foreground shrink-0 truncate">{result.artist}</span>
                      </div>
                    </div>
                  )}</MusicContextMenu>
                )}
              </For>
            </Match>

            <Match when={searchType() === 'artist'}>
              <For each={artistResults()}>
                {result => (
                  <div
                    class="card gap-2 p-2 cursor-default hover:bg-muted transition-colors"
                    onClick={() => handleArtistCardClick(result)}
                  >
                    <div class="flex flex-col gap-2 h-full">
                      <ProviderImage provider={result.provider} usage="card" src={result.coverUrl} alt="cover" referrerpolicy="no-referrer" class="w-full aspect-ratio-video rounded-md object-cover shrink-0" />
                      <span class="text-sm/relaxed font-semibold line-clamp-2 h-[calc(var(--leading-relaxed)*1em)]">{result.name}</span>
                      <span class="text-xs text-muted-foreground shrink-0 truncate">{result.description}</span>
                    </div>
                  </div>
                )}
              </For>
            </Match>

            <Match when={searchType() === 'album'}>
              <For each={albumResults()}>
                {result => (
                  <div class="card gap-2 p-2 cursor-default hover:bg-muted transition-colors" onClick={() => handleAlbumCardClick(result)}>
                    <div class="flex flex-col gap-2 h-full">
                      <ProviderImage provider={result.provider} usage="card" src={result.coverUrl} alt="cover" referrerpolicy="no-referrer" class="w-full aspect-ratio-video rounded-md object-cover shrink-0" />
                      <span class="text-sm/relaxed font-semibold line-clamp-2 h-[calc(2*var(--leading-relaxed)*1em)]">{result.title}</span>
                      <span class="text-xs text-muted-foreground shrink-0 truncate">{result.artist}</span>
                    </div>
                  </div>
                )}
              </For>
            </Match>
          </Switch>
        </div>

        <Pagination
          modelValue={pagination().page}
          total={pagination().total}
          pageSize={pagination().pageSize}
          onPageChange={page => handleSearch(page, searchType())}
        />
      </Show>
    </div>
  )
}
