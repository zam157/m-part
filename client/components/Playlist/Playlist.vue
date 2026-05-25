<script setup lang="ts">
import { clearPlaylist, currentIndex, playing, playlist, removeFromPlaylist, setCurrentIndex, setPlaying, showPlaylist } from '~/composables/player'
</script>

<template>
  <div
    :class="showPlaylist ? 'w-80' : 'w-0 hidden'"
    class="
      flex flex-col of-hidden
      gap-0.5 bg-sidebar text-sidebar-foreground grow-0 shrink-0
      starting:w-0 transition-[width,display] duration-300 transition-discrete
      border-l border-sidebar-border
    "
  >
    <div class="flex-1 min-h-0 p-2 of-y-auto">
      <div
        v-for="(i, index) in playlist"
        :key="index"
        class="ghost-btn flex px-2 h-12 justify-start content-visibility-auto"
        :class="{
          'bg-accent text-accent-foreground': currentIndex === index,
        }"
      >
        <div
          class="cover-container relative size-9 rounded-md bg-neutral-200 dark:bg-neutral-500 shrink-0"
          @click="async () => {
            if (currentIndex === index) {
              await setPlaying(!playing)
              return
            }
            await setCurrentIndex(index)
            await setPlaying(true)
          }"
        >
          <img v-if="i.coverUrl" :src="i.coverUrl" class="w-full h-full rounded-md">
          <div
            :class="[
              playing && currentIndex === index ? 'i-solar:pause-bold' : 'i-solar:play-bold',
              { 'opacity-0 hidden': currentIndex !== index },
            ]"
            class="play-icon text-3 block absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 transition-[opacity,display] transition-discrete"
          />
        </div>
        <div class="flex-1 min-w-0 flex flex-col">
          <span class="max-w-full truncate">{{ i.title }}</span>
          <span class="text-xs text-muted-foreground truncate max-w-full truncate">{{ i.artist }}</span>
        </div>
        <div
          class="i-solar:close-circle-bold text-3.5 hover:text-destructive transition-color grow-0 shrink-0"
          @click.stop="removeFromPlaylist(index)"
        />
      </div>
    </div>

    <!-- footer -->
    <div class="shrink-0 p-2 flex items-center">
      <div
        class="ghost-btn p-2 text-4" @click="async () => {
          clearPlaylist()
          showPlaylist = false
        }"
      >
        <div class="i-solar:trash-bin-trash-bold" />
      </div>
    </div>
  </div>
</template>

<style scoped>
.cover-container {
  &:hover .play-icon {
    opacity: 1;
    display: block;
  }
}
</style>
