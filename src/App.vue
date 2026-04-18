<script setup lang="ts">
import MusicPlayer from './components/MusicPlayer/MusicPlayer.vue'
import { playlist, showPlaylist } from './composables/player'
</script>

<template>
  <div
    class="
      h-100dvh
      bg-background text-foreground text-center
      flex flex-col
    "
  >
    <main class="flex-1 min-h-0 flex">
      <RouterView />
      <!-- playlist -->
      <div
        style="transition: width 0.2s var(--default-transition-timingFunction), display 0.2s var(--default-transition-timingFunction) allow-discrete;"
        :class="showPlaylist ? 'w-80' : 'w-0 hidden'"
        class="
          h-full bg-sidebar text-sidebar-foreground grow-0 shrink-0
          starting:w-0
        "
      >
        <div class="w-80 h-full of-y-auto">
          {{ playlist }}
        </div>
      </div>
    </main>
    <MusicPlayer class="grow-0 shrink-0" />
  </div>
</template>
