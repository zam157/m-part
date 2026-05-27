<script setup lang="ts">
import type { ArtistInfo, MusicInfo } from '#shared/types/music-info'
import type { Pagination as PaginationType, ProviderName } from '#shared/types/provider'
import { providers } from '#shared/utils/providers/index'
import Pagination from '~/components/Pagination/Pagination.vue'
import TabContent from '~/components/Tabs/TabContent.vue'
import Tabs from '~/components/Tabs/Tabs.vue'
import { setPlaylist } from '~/composables/player'

const route = useRoute('/artist-detail/[provider]/[id]')
const provider = route.params.provider as ProviderName
const artistId = route.params.id as string
const providerInstance = providers[provider]

const artistInfoState = shallowReactive({
  loading: true,
  info: null as ArtistInfo | null,
})
const artistWorksState = shallowReactive({
  loading: true,
  works: [] as MusicInfo[],
  pagination: shallowReactive({
    page: 1,
    total: 0,
    pageSize: 20,
  }) as PaginationType,
})
const activeTab = ref<'music' | 'albums'>('music')
const tabs = [
  { value: 'music', label: '单曲' },
  { value: 'albums', label: '专辑' },
] satisfies { value: 'music' | 'albums', label: string }[]

async function getArtistInfo() {
  if (!providerInstance.getArtistInfo)
    return null
  artistInfoState.info = await providerInstance.getArtistInfo(artistId)
  artistInfoState.loading = false
}

async function getArtistWorks(page: number) {
  if (!providerInstance.getArtistWorks)
    return null
  const [works, pagination] = await providerInstance.getArtistWorks(artistId, page)
  artistWorksState.works = works
  artistWorksState.pagination = pagination
  artistWorksState.loading = false
}

getArtistInfo()
getArtistWorks(1)
</script>

<template>
  <div class="size-full flex flex-col gap-3 p-4">
    <div class="grow-0 h-32 shrink-0 flex items-center gap-4">
      <img v-if="!artistInfoState.loading" :src="artistInfoState.info?.coverUrl" referrerpolicy="no-referrer" alt="Artist Avatar" class="h-full aspect-square object-cover rounded">
      <div v-else class="skeleton h-full aspect-square object-cover rounded" />
      <div class="flex flex-col gap-1">
        <div :class="{ 'skeleton w-16 h-[1em]': artistInfoState.loading }" class="text-xl font-bold">
          {{ artistInfoState.info?.name }}
        </div>
        <div :class="{ 'skeleton w-24 h-[1em]': artistInfoState.loading }" class="text-sm text-muted-foreground">
          {{ artistInfoState.info?.description }}
        </div>
        <button
          v-if="!artistWorksState.loading"
          class="btn px-3 py-1 mt-2 w-24"
          @click="setPlaylist(artistWorksState.works)"
        >
          {{ !artistWorksState.loading ? '播放全部' : ' ' }}
        </button>
        <div v-else class="skeleton w-24 h-8 mt-2" />
      </div>
    </div>
    <Tabs v-model="activeTab" class="grow-0" :tabs="tabs">
      <TabContent value="music" class="flex-1 min-h-0 overflow-auto flex flex-col gap-1 pb-2">
        <template v-if="artistWorksState.loading">
          <div v-for="i in 6" :key="i" class="flex items-center gap-2 p-1.5 h-12">
            <div class="skeleton h-10 aspect-square object-cover rounded-lg shrink-0" />
            <div class="flex flex-col flex-1 min-w-0 gap-2">
              <div class="text-sm font-medium truncate skeleton h-[1em] w-[6em]" />
              <div class="text-xs text-muted-foreground truncate skeleton h-[1em] w-[12em]" />
            </div>
          </div>
        </template>
        <template v-else>
          <div v-for="work in artistWorksState.works" :key="work.id" class="ghost-btn flex items-center gap-2 p-1.5 h-12">
            <img :src="work.coverUrl" referrerpolicy="no-referrer" alt="Work Cover" class="h-10 aspect-square object-cover rounded-lg shrink-0">
            <div class="flex flex-col flex-1 min-w-0">
              <div class="text-sm font-medium w-full truncate">
                {{ work.title }}
              </div>
              <div class="text-xs text-muted-foreground w-full truncate">
                {{ work.artist }}
              </div>
            </div>
          </div>
          <Pagination
            :modelValue="artistWorksState.pagination.page"
            :total="artistWorksState.pagination.total"
            :pageSize="artistWorksState.pagination.pageSize"
            @pageChange="getArtistWorks($event)"
          />
        </template>
      </TabContent>
    </Tabs>
  </div>
</template>
