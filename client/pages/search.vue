<script setup lang="ts">
import type { AlbumInfo, ArtistInfo, MusicInfo } from '#shared/types/music-info'
import type { Pagination as PaginationType, Provider, ProviderName, SearchType } from '#shared/types/provider'
import type { Option } from '~/components/Select/type'
import { providers } from '#shared/utils/providers/index'
import Pagination from '~/components/Pagination/Pagination.vue'
import Select from '~/components/Select/Select.vue'
import { addToPlaylist } from '~/composables/player'

type SearchState = {
  searching: boolean
  keyword: string
  pagination: PaginationType
} & (
  | { searchType: 'music', results: MusicInfo[] }
  | { searchType: 'album', results: AlbumInfo[] }
  | { searchType: 'artist', results: ArtistInfo[] }
)

const router = useRouter()

const sourceOptions = [
  { label: 'BiliBili', value: 'bili' },
  // { label: '网易云', value: 'netease' },
  // { label: 'QQ音乐', value: 'qq' },
] as const satisfies Option<ProviderName>[]
const typeOptions = [
  { label: '歌曲', value: 'music' },
  { label: '专辑', value: 'album' },
  { label: '歌手', value: 'artist' },
] as const satisfies Option<SearchType>[]
const selectedSource = shallowRef<typeof sourceOptions[number]['value']>(sourceOptions[0].value)
const selectedType = shallowRef<typeof typeOptions[number]['value']>(typeOptions[0].value)

// 根据当前 provider 的能力动态禁用不支持的类型
const availableTypeOptions = computed<Option<SearchType>[]>(() => {
  const provider = providers[selectedSource.value] as Provider
  return typeOptions.map((opt) => {
    let isDisabled = false
    if (opt.value === 'music' && !provider.search)
      isDisabled = true
    else if (opt.value === 'album' && !provider.searchAlbum)
      isDisabled = true
    else if (opt.value === 'artist' && !provider.searchArtist)
      isDisabled = true
    return { ...opt, disabled: isDisabled }
  })
})

const searchState = shallowReactive({
  searching: false,
  searchType: selectedType.value,
  keyword: '',
  results: [] as MusicInfo[],
  pagination: shallowReactive({
    page: 1,
    total: 0,
    pageSize: 20,
  }),
} as SearchState)

async function handleSearch(page: number, type: SearchType) {
  if (searchState.searching)
    return
  const keyword = searchState.keyword.trim()
  if (!keyword) {
    searchState.results = []
    searchState.pagination = { page: 1, total: 0, pageSize: 20 }
    return
  }
  searchState.pagination.page = page
  const provider = providers[selectedSource.value] as Provider
  searchState.searching = true

  let searchFn: Provider['search'] | Provider['searchArtist'] | Provider['searchAlbum']
  if (type === 'music')
    searchFn = provider.search
  else if (type === 'artist')
    searchFn = provider.searchArtist
  else if (type === 'album')
    searchFn = provider.searchAlbum

  if (!searchFn) {
    console.warn(`Provider ${selectedSource.value} does not support searching for type ${type}`)
    searchState.results = []
    searchState.pagination = { page: 1, total: 0, pageSize: 20 }
    searchState.searching = false
    return
  }

  try {
    const [results, pageData] = await searchFn(keyword, page)
    searchState.results = results
    searchState.pagination = pageData
    searchState.searchType = type
  }
  catch (error) {
    console.error('Search error:', error)
    searchState.results = []
    searchState.pagination = { page: 1, total: 0, pageSize: 20 }
  }
  finally {
    searchState.searching = false
  }
}

function handleArtistCardClick(artist: ArtistInfo) {
  // 跳转到歌手详情页
  router.push(`/artist-detail/${selectedSource.value}/${artist.id}`)
}
</script>

<template>
  <div class="@container size-full flex flex-col gap-2 py-2">
    <form class="flex gap-2 grow-0 shrink-0 px-4" @submit.prevent="handleSearch(1, selectedType)">
      <div class="btn-group h-8 flex-1">
        <Select
          v-model="selectedSource"
          placeholder="音源"
          :options="sourceOptions"
          contentStyle="justify-self:auto;right:anchor(right);left:auto;"
          triggerClass="w-16"
        />
        <Select
          v-model="selectedType"
          placeholder="类型"
          :options="availableTypeOptions"
          contentStyle="justify-self:auto;left:anchor(left);"
          triggerClass="w-16"
        />
        <input
          v-model="searchState.keyword"
          name="search"
          placeholder="Search..."
          class="h-8 input"
        >
      </div>
      <button class="btn h-8 px-3" type="submit">
        <div v-if="searchState.searching" class="i-lucide:loader-circle text-4 animate-spin" />
        搜 索
      </button>
    </form>
    <template v-if="searchState.results.length">
      <div class="min-h-0 flex-1 overflow-auto grid gap-4 grid-cols-1 @6xl:grid-cols-5 @xl:grid-cols-3 @sm:grid-cols-2 grid-auto-rows-max px-4 pb-4 pt-2">
        <template v-if="searchState.searchType === 'music'">
          <div v-for="(result, index) in searchState.results" :key="index" class="card gap-2 p-2 cursor-default hover:bg-muted transition-colors" @click="addToPlaylist(result)">
            <div class="flex flex-col gap-2 h-full">
              <img :src="result.coverUrl" alt="cover" referrerpolicy="no-referrer" class="w-full aspect-ratio-video rounded-md object-cover shrink-0">
              <span class="text-sm/relaxed font-semibold line-clamp-2" style="height:calc(2*var(--leading-relaxed)*1em)" v-html="result.title" />
              <span class="text-xs text-muted-foreground shrink-0 truncate">{{ result.artist }}</span>
            </div>
          </div>
        </template>
        <template v-if="searchState.searchType === 'artist'">
          <div
            v-for="(result, index) in searchState.results"
            :key="index"
            class="card gap-2 p-2 cursor-default hover:bg-muted transition-colors"
            @click="handleArtistCardClick(result)"
          >
            <div class="flex flex-col gap-2 h-full">
              <img :src="result.coverUrl" alt="cover" referrerpolicy="no-referrer" class="w-full aspect-ratio-video rounded-md object-cover shrink-0">
              <span class="text-sm/relaxed font-semibold line-clamp-2" style="height:calc(1*var(--leading-relaxed)*1em)" v-text="result.name" />
              <span class="text-xs text-muted-foreground shrink-0 truncate">{{ result.description }}</span>
            </div>
          </div>
        </template>
        <template v-if="searchState.searchType === 'album'">
          <div
            v-for="(result, index) in searchState.results"
            :key="index"
            class="card gap-2 p-2 cursor-default hover:bg-muted transition-colors"
          >
            <div class="flex flex-col gap-2 h-full">
              <img :src="result.coverUrl" alt="cover" referrerpolicy="no-referrer" class="w-full aspect-ratio-video rounded-md object-cover shrink-0">
              <span class="text-sm/relaxed font-semibold line-clamp-2" style="height:calc(2*var(--leading-relaxed)*1em)" v-text="result.title" />
              <span class="text-xs text-muted-foreground shrink-0 truncate">{{ result.artist }}</span>
            </div>
          </div>
        </template>
      </div>
      <Pagination :modelValue="searchState.pagination.page" :total="searchState.pagination.total" :pageSize="searchState.pagination.pageSize" @pageChange="handleSearch($event, searchState.searchType)" />
    </template>
    <div v-else class="empty">
      <div class="i-lucide:search-slash text-6" />
      <span class="text-sm/relaxed font-medium">没有找到相关内容</span>
      <span class="text-xs text-muted-foreground">试试换个关键词？</span>
    </div>
  </div>
</template>
