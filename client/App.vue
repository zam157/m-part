<script setup lang="ts">
import MusicPlayer from './components/MusicPlayer/MusicPlayer.vue'
import Playlist from './components/Playlist/Playlist.vue'
import Sidebar from './components/Sidebar/Sidebar.vue'

const router = useRouter()
const excludeNames = computed(() =>
  router.getRoutes()
    .filter(route => typeof route.name === 'string' && route.meta.noKeepAlive)
    .map(route => route.name as string),
)
</script>

<template>
  <div
    class="
      h-100svh of-auto
      bg-background text-foreground selection:text-muted selection:bg-muted-foreground
      flex flex-col
    "
  >
    <main class="flex-1 min-h-0 flex">
      <Sidebar />
      <RouterView v-slot="{ Component }">
        <KeepAlive :exclude="excludeNames">
          <component :is="Component" />
        </KeepAlive>
      </RouterView>
      <Playlist />
    </main>
    <MusicPlayer />
  </div>
</template>
