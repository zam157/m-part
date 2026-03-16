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
const timeTooltipRef = useTemplateRef('timeTooltipRef')

// 格式化时间为 MM:SS 格式
function formatTime(seconds: number): string {
  const totalSeconds = Math.floor(seconds)
  const minutes = Math.floor(totalSeconds / 60)
  const secs = totalSeconds % 60
  return `${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
}

// 计算当前显示的时间（拖动时使用 tempProgress，否则使用 currentTime）
const displayTime = computed(() => {
  const timeInSeconds = tempProgress.value !== null
    ? tempProgress.value * duration.value
    : currentTime.value
  return formatTime(timeInSeconds)
})

// 完整的时间显示字符串
const timeDisplay = computed(() => {
  return `${displayTime.value} / ${formatTime(duration.value)}`
})

// 计算 tooltip 的位置
const tooltipPosition = computed(() => {
  // 确保 tooltip 在视口范围内
  if (timeTooltipRef.value) {
    const tooltipRect = timeTooltipRef.value.getBoundingClientRect()
    const progressBarRect = progressBarRef.value?.getBoundingClientRect()
    if (progressBarRect) {
      const halfTooltipWidth = tooltipRect.width / 2
      const left = (progress.value * progressBarRect.width) + progressBarRect.left
      const clampedLeft = Math.max(halfTooltipWidth, Math.min(window.innerWidth - halfTooltipWidth, left))
      return `${clampedLeft}px`
    }
  }
  return `${progress.value * 100}%`
})

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
  <div
    :style="{
      '--progress-percent': `${progress * 100}%`,
    }"
    class="flex flex-col select-none inset-x-0 bottom-0 fixed z-50"
  >
    <!-- Progress bar -->
    <div
      ref="progressBarRef"
      class="progress-bar-wrapper py-2 cursor-pointer relative z-1 -my-2"
      @pointerdown="handlePointerDown"
      @pointermove="handlePointerMove"
      @pointerup="handlePointerUp"
    >
      <!-- Tooltip -->
      <div
        ref="timeTooltipRef"
        class="tooltip text-sm text-white px-2 py-1 rounded-lg bg-black/80 opacity-0 invisible pointer-events-none whitespace-nowrap transition-[opacity,visibility] duration-200 absolute tabular-nums -translate-x-1/2 -translate-y-[calc(100%+0.5rem)]"
        :style="{ left: tooltipPosition }"
      >
        {{ timeDisplay }}
      </div>

      <div
        class="progress-bar bg-light-500/80 flex h-1 transition-height justify-start relative touch-none dark:bg-gray-500/70"
      >
        <div
          class="rounded-r-full bg-blue/80 h-full origin-left"
          :style="{ width: `var(--progress-percent)` }"
        />
        <div class="thumb rounded-full bg-blue h-3 w-3 transition-[opacity,visibility] duration-500 transition-discrete top-1/2 absolute -translate-x-1/2 -translate-y-1/2" :style="{ left: `var(--progress-percent)` }" />
      </div>
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
.progress-bar-wrapper {
  .progress-bar {
    > .thumb {
      visibility: hidden;
      opacity: 0;
    }
  }
  &:hover .progress-bar {
    @apply h-1.5;
    > .thumb {
      visibility: visible;
      opacity: 1;
    }
  }
  &:hover .tooltip {
    opacity: 1;
    visibility: visible;
  }
}
</style>
