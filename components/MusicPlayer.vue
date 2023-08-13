<script setup lang="ts">
const audioRef = ref<HTMLAudioElement>()
const { playing } = useMediaControls(audioRef, { src: 'https://sound.vueuse.org/sounds/909-drums.mp3' })
</script>

<template>
  <div fixed inset-x-0 bottom-0 z-50 flex="~ col">
    <!-- Process bar -->
    <div h="4px" hover="h-[6px] cursor-pointer" transition-height>
      <div w="1/2" h-full bg-blue />
    </div>

    <!-- Music player -->
    <div h-19 flex>
      <audio ref="audioRef" />
      <!-- Music image -->
      <div aspect-1 h-full bg-blue-gray />

      <!-- Music info -->
      <div flex="~ col 1" items-start justify-center gap-2 px-4>
        <!-- Song name -->
        <span font-bold text-black dark:text-white>Chaff & Dust</span>
        <!-- Artist name -->
        <span text-xs text-gray:80>HYONNA</span>
      </div>

      <!-- Play button -->
      <div class="btn-wrapper" flex="~" items-center justify-between gap-2 px-2 font-size-6>
        <span class="i-material-symbols:skip-previous-rounded" />
        <span :class="playing ? 'i-material-symbols:pause-rounded' : 'i-material-symbols:play-arrow-rounded'" @click="playing = !playing" />
        <!-- <span class="i-material-symbols:play-arrow-rounded" /> -->
        <span class="i-material-symbols:skip-next-rounded" />
      </div>
    </div>
  </div>
</template>

<style scoped>
.btn-wrapper > span {
  @apply hover:cursor-pointer hover:text-gray/90 active:text-light/90;
}
</style>
