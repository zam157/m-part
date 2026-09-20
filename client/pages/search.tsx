import type { ArtistInfo } from '#shared/types/music-info'
import { useNavigate } from '@solidjs/router'
import { For, Match, Show, Switch } from 'solid-js'
import ErrorMessage from '~/components/ErrorMessage/ErrorMessage'
import Pagination from '~/components/Pagination/Pagination'
import Select from '~/components/Select/Select'
import { addToPlayQueue } from '~/composables/player'
import {
  albumResults,
  artistResults,
  availableTypeOptions,
  currentResults,
  handleSearch,
  keyword,
  musicResults,
  pagination,
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

export default function SearchPage() {
  const navigate = useNavigate()

  function handleArtistCardClick(artist: ArtistInfo) {
    // 跳转到歌手详情页
    navigate(`/artist-detail/${selectedSource()}/${artist.id}`)
  }

  return (
    <div class="flex-1 min-w-0 flex flex-col gap-2 py-2">
      <form
        class="flex gap-2 grow-0 shrink-0 px-4"
        onSubmit={(event) => {
          event.preventDefault()
          handleSearch(1, selectedType())
        }}
      >
        <div class="btn-group h-8 flex-1">
          <Select
            value={selectedSource()}
            onValueChange={setSelectedSource}
            placeholder="音源"
            options={sourceOptions}
            contentStyle="justify-self:auto;right:anchor(right);left:auto;"
            triggerClass="w-16"
          />
          <Select
            value={selectedType()}
            onValueChange={setSelectedType}
            placeholder="类型"
            options={availableTypeOptions()}
            contentStyle="justify-self:auto;left:anchor(left);"
            triggerClass="w-16"
          />
          <input
            name="search"
            placeholder="Search..."
            class="h-8 input"
            value={keyword()}
            onInput={event => setKeyword(event.currentTarget.value)}
          />
        </div>
        <button class="btn h-8 px-3" type="submit">
          <Show when={searching()}>
            <div class="i-lucide:loader-circle text-4 animate-spin" />
          </Show>
          搜 索
        </button>
      </form>

      <Show
        when={currentResults().length}
        fallback={(
          <Show
            when={searchError()}
            fallback={(
              <div class="empty">
                <div class="i-lucide:search-slash text-6" />
                <span class="text-sm/relaxed font-medium">没有找到相关内容</span>
                <span class="text-xs text-muted-foreground">试试换个关键词？</span>
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
        <div class="min-h-0 flex-1 overflow-auto grid gap-4 responsive-cols grid-auto-rows-max px-4 pb-4 pt-2">
          <Switch>
            <Match when={searchType() === 'music'}>
              <For each={musicResults()}>
                {result => (
                  <div
                    class="card gap-2 p-2 cursor-default hover:bg-muted transition-colors"
                    onClick={() => addToPlayQueue(result)}
                  >
                    <div class="flex flex-col gap-2 h-full">
                      <img src={result.coverUrl} alt="cover" referrerpolicy="no-referrer" class="w-full aspect-ratio-video rounded-md object-cover shrink-0" />
                      <span class="text-sm/relaxed font-semibold line-clamp-2" style={{ height: 'calc(2*var(--leading-relaxed)*1em)' }} innerHTML={result.title} />
                      <span class="text-xs text-muted-foreground shrink-0 truncate">{result.artist}</span>
                    </div>
                  </div>
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
                      <img src={result.coverUrl} alt="cover" referrerpolicy="no-referrer" class="w-full aspect-ratio-video rounded-md object-cover shrink-0" />
                      <span class="text-sm/relaxed font-semibold line-clamp-2" style={{ height: 'calc(1*var(--leading-relaxed)*1em)' }}>{result.name}</span>
                      <span class="text-xs text-muted-foreground shrink-0 truncate">{result.description}</span>
                    </div>
                  </div>
                )}
              </For>
            </Match>

            <Match when={searchType() === 'album'}>
              <For each={albumResults()}>
                {result => (
                  <div class="card gap-2 p-2 cursor-default hover:bg-muted transition-colors">
                    <div class="flex flex-col gap-2 h-full">
                      <img src={result.coverUrl} alt="cover" referrerpolicy="no-referrer" class="w-full aspect-ratio-video rounded-md object-cover shrink-0" />
                      <span class="text-sm/relaxed font-semibold line-clamp-2" style={{ height: 'calc(2*var(--leading-relaxed)*1em)' }}>{result.title}</span>
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
