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

function handlePointerDown(e: PointerEvent) {
  scrubbing.value = true
  updateTempProgress(e.clientX)
  // 捕获确保即使指针离开元素也能继续接收事件
  ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
}

function handlePointerMove(e: PointerEvent) {
  if (!scrubbing.value)
    return
  updateTempProgress(e.clientX)
}

function handlePointerUp(e: PointerEvent) {
  if (!scrubbing.value)
    return
  scrubbing.value = false
  // 释放捕获
  ;(e.target as HTMLElement).releasePointerCapture(e.pointerId)

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
      class="progress-bar bg-light-500/80 flex h-1 transition-height justify-start relative touch-none dark:bg-gray-500/70 hover:h-1.5 hover:cursor-pointer"
      @pointerdown="handlePointerDown"
      @pointermove="handlePointerMove"
      @pointerup="handlePointerUp"
    >
      <div
        class="rounded-r-full bg-blue/80 h-full origin-left"
        :style="{ width: `${progress * 100}%` }"
      />
      <div class="thumb rounded-full bg-blue h-3 w-3 transition-[opacity,visibility] duration-500 transition-discrete top-1/2 absolute -translate-x-1/2 -translate-y-1/2" :style="{ left: `${progress * 100}%` }" />
    </div>

    <!-- Music player -->
    <div class="flex h-19">
      <audio ref="audioRef" />
      <!-- Music image -->
      <div class="bg-gray h-full aspect-1" />

      <!-- Music info -->
      <div class="mx-4 flex flex-1 flex-col gap-2 min-w-0 items-start justify-center">
        <!-- Song name -->
        <span class="text-black font-bold max-w-full min-w-0 truncate dark:text-white">Chaff & Dust</span>
        <!-- Artist name -->
        <span class="text-xs text-gray/80 max-w-full min-w-0 truncate">
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
.progress-bar {
  > .thumb {
    visibility: hidden;
    opacity: 0;
  }
  &:hover > .thumb {
    visibility: visible;
    opacity: 1;
  }
}
</style>
