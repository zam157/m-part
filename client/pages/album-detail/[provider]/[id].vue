<script setup lang="ts">
import type { MusicInfo } from '#shared/types/music-info'
import type { Pagination as PaginationType, ProviderName } from '#shared/types/provider'
import { providers } from '#shared/utils/providers/index'
import Pagination from '~/components/Pagination/Pagination.vue'
import { addToPlaylist, setPlaylist } from '~/composables/player'

definePage({
  name: 'AlbumDetailPage',
  meta: {
    noKeepAlive: true,
  },
})

const route = useRoute<'AlbumDetailPage'>()
const provider = route.params.provider as ProviderName
const albumId = route.params.id as string
const artist = route.query.artist as string
const cover = route.query.cover as string
const title = route.query.title as string
const query = route.query
const providerInstance = providers[provider]

const albumWorksState = shallowReactive({
  loading: true,
  works: [] as MusicInfo[],
  pagination: shallowReactive<PaginationType>({
    page: 1,
    total: 0,
    pageSize: 20,
  }),
})

async function getAlbumWorks(page: number) {
  if (!providerInstance.getAlbumWorks)
    return
  try {
    const [works, pagination] = await providerInstance.getAlbumWorks(albumId, page, query)
    albumWorksState.works = works
    albumWorksState.pagination = pagination
  }
  finally {
    albumWorksState.loading = false
  }
}

async function handlePlay(music: MusicInfo) {
  await addToPlaylist(music)
}

getAlbumWorks(1)
</script>

<template>
  <div class="size-full flex flex-col gap-3 p-4">
    <!-- Album Info -->
    <div class="grow-0 h-32 shrink-0 flex items-center gap-4">
      <img
        v-if="cover"
        :src="cover"
        referrerpolicy="no-referrer"
        alt="Album Cover"
        class="h-full aspect-square object-cover rounded-lg"
      >
      <div class="flex flex-col gap-1">
        <div class="text-xl font-bold">
          {{ title || '未知专辑' }}
        </div>
        <div class="text-sm text-muted-foreground">
          {{ artist || '未知艺术家' }}
        </div>
        <button
          v-if="!albumWorksState.loading && albumWorksState.works.length"
          class="btn px-3 py-1 mt-2 w-24"
          @click="setPlaylist(albumWorksState.works)"
        >
          播放全部
        </button>
        <div v-else-if="albumWorksState.loading" class="skeleton w-24 h-8 mt-2" />
      </div>
    </div>

    <!-- Track List -->
    <div class="flex-1 min-h-0 overflow-auto flex flex-col gap-1 pb-2">
      <template v-if="!providerInstance.getAlbumWorks">
        <div class="empty">
          <span class="i-solar:danger-circle-bold text-4xl text-foreground/20 mb-2" />
          <span class="text-foreground/30">当前音源不支持专辑</span>
        </div>
      </template>
      <template v-else-if="albumWorksState.loading">
        <div v-for="i in 6" :key="i" class="flex items-center gap-2 p-1.5 h-12">
          <div class="skeleton h-10 aspect-square rounded-lg shrink-0" />
          <div class="flex flex-col flex-1 min-w-0 gap-2">
            <div class="skeleton h-[1em] w-[6em]" />
            <div class="skeleton h-[1em] w-[12em]" />
          </div>
        </div>
      </template>
      <template v-else-if="albumWorksState.works.length">
        <div
          v-for="work in albumWorksState.works"
          :key="work.id"
          class="ghost-btn flex items-center gap-2 p-1.5 h-12"
          @click="handlePlay(work)"
        >
          <img
            :src="work.coverUrl"
            referrerpolicy="no-referrer"
            alt="Track Cover"
            class="h-10 aspect-square object-cover rounded-lg shrink-0"
          >
          <div class="flex flex-col flex-1 min-w-0">
            <div class="text-sm font-medium w-full truncate min-h-1em">
              {{ work.title }}
            </div>
            <div class="text-xs text-muted-foreground w-full truncate min-h-1em">
              {{ work.artist }}
            </div>
          </div>
        </div>
        <Pagination
          :modelValue="albumWorksState.pagination.page"
          :total="albumWorksState.pagination.total"
          :pageSize="albumWorksState.pagination.pageSize"
          @pageChange="getAlbumWorks($event)"
        />
      </template>
      <div v-else class="empty">
        <span class="i-solar:music-notes-bold text-4xl text-foreground/20 mb-2" />
        <span class="text-foreground/30">暂无曲目</span>
      </div>
    </div>
  </div>
</template>
