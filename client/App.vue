<script setup lang="ts">
import MusicPlayer from './components/MusicPlayer/MusicPlayer.vue'
import Playlist from './components/Playlist/Playlist.vue'
</script>

<template>
  <div
    class="
      h-100dvh
      bg-background text-foreground selection:text-muted selection:bg-muted-foreground
      flex flex-col
    "
  >
    <main class="flex-1 min-h-0 flex">
      <RouterView />
      <Playlist />
    </main>
    <MusicPlayer class="grow-0 shrink-0" />
  </div>
</template>
