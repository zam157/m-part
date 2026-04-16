<script setup lang="ts">
import MusicPlayer from './components/MusicPlayer/MusicPlayer.vue'
</script>

<template>
  <div
    class="
      h-100dvh
      text-gray-700 text-center dark:text-gray-200
      flex flex-col
    "
  >
    <main class="flex-1 min-h-0">
      <RouterView />
    </main>
    <MusicPlayer class="grow-0 shrink-0" />
  </div>
</template>
