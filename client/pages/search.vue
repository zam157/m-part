<script setup lang="ts">
import type { MusicInfo } from '#shared/types/music-info'
import type { Pagination as PaginationType, ProviderName, SearchType } from '#shared/types/provider'
import type { Option } from '~/components/Select/type'
import { providers } from '#shared/utils/providers/index'
import Pagination from '~/components/Pagination/Pagination.vue'
import Select from '~/components/Select/Select.vue'
import { addToPlaylist } from '~/composables/player'

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

const searching = shallowRef(false)
const searchKeyword = shallowRef('')
const searchResults = shallowRef<MusicInfo[]>([])
const pagination = ref<PaginationType>({
  page: 1,
  total: 0,
  pageSize: 20,
})
async function handleSearch(page: number) {
  if (searching.value)
    return
  const keyword = searchKeyword.value.trim()
  if (!keyword) {
    searchResults.value = []
    pagination.value = { page: 1, total: 0, pageSize: 20 }
    return
  }
  pagination.value.page = page
  const provider = providers[selectedSource.value]
  searching.value = true
  try {
    const [results, pageData] = await provider.search(keyword, page, selectedType.value)
    searchResults.value = results
    pagination.value = pageData
  }
  catch (error) {
    console.error('Search error:', error)
    searchResults.value = []
    pagination.value = { page: 1, total: 0, pageSize: 20 }
  }
  finally {
    searching.value = false
  }
}
</script>

<template>
  <div class="@container size-full flex flex-col gap-2 py-2">
    <form class="flex gap-2 grow-0 shrink-0 px-4" @submit.prevent="handleSearch(1)">
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
          :options="typeOptions"
          contentStyle="justify-self:auto;left:anchor(left);"
          triggerClass="w-16"
        />
        <input
          v-model="searchKeyword"
          name="search"
          placeholder="Search..."
          class="h-8 input"
        >
      </div>
      <button class="btn h-8 px-3" type="submit">
        <div v-if="searching" class="i-lucide:loader-circle text-4 animate-spin" />
        搜 索
      </button>
    </form>
    <template v-if="searchResults.length">
      <div class="min-h-0 flex-1 overflow-auto grid gap-4 grid-cols-1 @6xl:grid-cols-5 @xl:grid-cols-3 @sm:grid-cols-2 grid-auto-rows-max px-4 pb-4 pt-2">
        <div v-for="(result, index) in searchResults" :key="index" class="card gap-2 p-2 cursor-default hover:bg-muted transition-colors" @click="addToPlaylist(result)">
          <div class="flex flex-col gap-2 h-full">
            <img :src="result.coverUrl" alt="cover" referrerpolicy="no-referrer" class="w-full aspect-ratio-video rounded-md object-cover shrink-0">
            <span class="text-sm/relaxed font-semibold line-clamp-2" style="height:calc(2*var(--leading-relaxed)*1em)" v-html="result.title" />
            <span class="text-xs text-muted-foreground shrink-0 truncate">{{ result.artist }}</span>
          </div>
        </div>
      </div>
      <Pagination :modelValue="pagination.page" :total="pagination.total" :pageSize="pagination.pageSize" @pageChange="handleSearch" />
    </template>
    <div v-else class="empty">
      <div class="i-lucide:search-slash text-6" />
      <span class="text-sm/relaxed font-medium">没有找到相关内容</span>
      <span class="text-xs text-muted-foreground">试试换个关键词？</span>
    </div>
  </div>
</template>
