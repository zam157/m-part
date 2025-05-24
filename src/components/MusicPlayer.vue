<script setup lang="ts">
import VolumeSlider from './VolumeSlider.vue'

const audioRef = useTemplateRef('audioRef')
const { playing, duration, currentTime, volume } = useMediaControls(audioRef, { src: 'http://codeskulptor-demos.commondatastorage.googleapis.com/pang/paza-moduless.mp3' })

const tempProgress = ref<number | null>(null)
const progress = computed(() => {
  if (tempProgress.value !== null)
    return tempProgress.value

  return duration.value === 0 ? 0 : currentTime.value / duration.value
})

const scrubbing = ref(false)
const progressBarRef = useTemplateRef('progressBarRef')

// 统一处理进度更新逻辑
function updateTempProgress(clientX: number) {
  if (!progressBarRef.value)
    return
  const rect = progressBarRef.value.getBoundingClientRect()
  tempProgress.value = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width))
}

// 处理鼠标事件
function handleMouseDown(e: MouseEvent) {
  scrubbing.value = true
  updateTempProgress(e.clientX)
  window.addEventListener('mousemove', onMouseMove)
  window.addEventListener('mouseup', onMouseUp)
}
function onMouseMove(e: MouseEvent) {
  if (!scrubbing.value)
    return
  updateTempProgress(e.clientX)
}

function onMouseUp() {
  if (!scrubbing.value)
    return
  scrubbing.value = false
  if (tempProgress.value !== null) {
    const newTime = tempProgress.value * duration.value
    currentTime.value = newTime
    tempProgress.value = null
  }
  window.removeEventListener('mousemove', onMouseMove)
  window.removeEventListener('mouseup', onMouseUp)
}

// 处理触摸事件
function handleTouchStart(e: TouchEvent) {
  scrubbing.value = true
  updateTempProgress(e.touches[0].clientX)
}

function handleTouchMove(e: TouchEvent) {
  if (!scrubbing.value)
    return
  updateTempProgress(e.touches[0].clientX)
}

function handleTouchEnd() {
  if (!scrubbing.value)
    return
  scrubbing.value = false
  if (tempProgress.value !== null) {
    const newTime = tempProgress.value * duration.value
    currentTime.value = newTime
    tempProgress.value = null
  }
}
</script>

<template>
  <div class="flex flex-col select-none inset-x-0 bottom-0 fixed z-50">
    <!-- Process bar -->
    <div
      ref="progressBarRef"
      class="bg-light-500/80 flex h-1 transition-height justify-start dark:bg-gray-500/70 hover:h-1.5 hover:cursor-pointer"
      @mousedown="handleMouseDown"
      @touchstart="handleTouchStart"
      @touchmove="handleTouchMove"
      @touchend.prevent="handleTouchEnd"
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
