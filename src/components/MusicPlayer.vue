<script setup lang="ts">
import VolumeSlider from './VolumeSlider.vue'

const audioRef = ref<HTMLAudioElement>()
const { playing, duration, currentTime, volume } = useMediaControls(audioRef, { src: 'http://codeskulptor-demos.commondatastorage.googleapis.com/pang/paza-moduless.mp3' })

const progress = computed(() => duration.value === 0 ? 0 : currentTime.value / duration.value)

const scrubbing = ref(false)
// Pause the music when scrubbing
let isPlayingBeforeScrub = false
watch(scrubbing, (value) => {
  if (value) {
    isPlayingBeforeScrub = playing.value
    playing.value = false
  }
  else {
    playing.value = isPlayingBeforeScrub
  }
})

const progressBarRef = useTemplateRef('progressBarRef')
useEventListener('mouseup', () => scrubbing.value = false)
const { elementX, elementWidth } = useMouseInElement(progressBarRef)
watchEffect(() => {
  if (!scrubbing.value)
    return
  const _elementX = elementX.value < 0
    ? 0
    : elementX.value > elementWidth.value
      ? elementWidth.value
      : elementX.value
  const currentProgress = _elementX / elementWidth.value
  currentTime.value = currentProgress * duration.value
})
</script>

<template>
  <div class="flex flex-col select-none inset-x-0 bottom-0 fixed z-50">
    <!-- Process bar -->
    <div
      ref="progressBarRef"
      class="flex h-0.5 transition-height justify-start hover:h-1.5 hover:cursor-pointer"
      @mousedown="scrubbing = true"
    >
      <div
        class="bg-blue h-full w-full origin-left"
        :style="{ transform: `scaleX(${progress})` }"
      />
    </div>

    <!-- Music player -->
    <div class="flex h-19">
      <audio ref="audioRef" />
      <!-- Music image -->
      <div class="bg-gray h-full aspect-1" />

      <!-- Music info -->
      <div class="px-4 flex flex-1 flex-col gap-2 items-start justify-center">
        <!-- Song name -->
        <span class="text-black font-bold dark:text-white">Chaff & Dust</span>
        <!-- Artist name -->
        <span class="text-xs text-gray/80">
          HYONNA
        </span>
      </div>

      <!-- Volume -->
      <div class="text-6 px-2 flex gap-2 items-center justify-center">
        <VolumeSlider v-model="volume" />
      </div>

      <!-- Play button -->
      <div class="btn-wrapper px-2 flex gap-2 items-center">
        <div class="i-solar:skip-previous-bold text-5 transition-opacity hover:opacity-80" />
        <div class="text-9 transition-[transform,opacity] hover:opacity-90 hover:scale-110" :class="playing ? 'i-solar:pause-circle-bold' : 'i-solar:play-circle-bold'" @click="playing = !playing" />
        <div class="i-solar:skip-next-bold text-5 transition-opacity hover:opacity-80" />
      </div>
    </div>
  </div>
</template>

<style scoped>
</style>
