<script setup lang="ts">
const audioRef = ref<HTMLAudioElement>()
const { playing, duration, currentTime } = useMediaControls(audioRef, { src: 'http://codeskulptor-demos.commondatastorage.googleapis.com/pang/paza-moduless.mp3' })
const progress = computed(() => duration.value === 0 ? 0 : currentTime.value / duration.value)

const scrubbing = ref(false)
// Pause the music when scrubbing
const isPlayingBeforeScrub = ref(false)
watch(scrubbing, (value) => {
  if (value) {
    isPlayingBeforeScrub.value = playing.value
    playing.value = false
  }
  else {
    playing.value = isPlayingBeforeScrub.value
  }
})

const progressBarRef = ref<HTMLDivElement>()
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
  <div :class="{ 'select-none': scrubbing }" fixed inset-x-0 bottom-0 z-50 flex="~ col">
    <!-- Process bar -->
    <div
      ref="progressBarRef"
      h="4px" hover="h-[6px] cursor-pointer"
      flex justify-start transition-height
      @mousedown="scrubbing = true"
    >
      <div
        h-full w-full transform-origin-left bg-blue
        :style="{ transform: `scaleX(${progress})` }"
      />
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
