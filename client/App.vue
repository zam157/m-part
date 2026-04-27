<script setup lang="ts">
import MusicPlayer from './components/MusicPlayer/MusicPlayer.vue'
import Playlist from './components/Playlist/Playlist.vue'
</script>

<template>
  <div
    class="
      h-100dvh of-hidden
      bg-background text-foreground selection:text-muted selection:bg-muted-foreground
      flex flex-col
    "
  >
    <main class="flex-1 min-h-0 flex">
      <RouterView />
      <Playlist />
    </main>
    <MusicPlayer />
  </div>
</template>
