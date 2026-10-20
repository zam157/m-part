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
  hasSearched,
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
    <div class="search-page flex-1 min-w-0 flex flex-col gap-2">
      <header class="search-heading"><h1>发现音乐</h1><p>搜索歌曲和创作者，找到你想听的声音。</p></header>
      {/*
        搜索栏：宽度收在 max-w-2xl（原来是 flex-1，1700px 窗口下输入框拉到 1275px），
        左缘与下方结果网格对齐；高度用 h-10，btn-group 内部各段都是 h-full，一改整条跟着长高。
      */}
      <form
        class="search-form w-full grow-0 shrink-0 flex gap-2"
        onSubmit={(event) => {
          event.preventDefault()
          handleSearch(1, selectedType())
        }}
      >
        <div class="btn-group h-10 flex-1">
          <Select
            value={selectedSource()}
            onValueChange={setSelectedSource}
            placeholder="音源"
            options={sourceOptions}
            contentStyle="justify-self:auto;right:anchor(right);left:auto;"
            triggerClass="w-20"
          />
          <Select
            value={selectedType()}
            onValueChange={setSelectedType}
            placeholder="类型"
            options={availableTypeOptions()}
            contentStyle="justify-self:auto;left:anchor(left);"
            triggerClass="w-20"
          />
          <input
            name="search"
            placeholder="搜索歌曲、创作者…"
            aria-label="搜索关键词"
            class="h-full input"
            value={keyword()}
            onInput={event => setKeyword(event.currentTarget.value)}
          />
        </div>
        <button class="btn h-10 px-4" type="submit" disabled={searching()}>
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
                <div class="search-empty-icon"><span class={searching() ? 'i-lucide:loader-circle text-6 animate-spin' : 'i-lucide:search text-6'} /></div>
                <span class="text-sm/relaxed font-medium">{searching() ? '正在寻找好声音…' : hasSearched() ? '没有找到相关内容' : '你的下一首喜欢，从这里开始'}</span>
                <span class="text-xs text-muted-foreground">{searching() ? '稍等片刻，音乐即将抵达。' : hasSearched() ? '试试换个关键词？' : '输入关键词，按 Enter 或点击搜索。'}</span>
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
        <div class="search-results min-h-0 flex-1 overflow-auto grid gap-4 responsive-cols grid-auto-rows-max">
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
