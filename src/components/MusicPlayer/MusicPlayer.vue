<script setup lang="ts">
import {
  currentSong,
  currentTime,
  duration,
  playing,
  prevNext,
  progress,
  seeking,
  setCurrentIndex,
  setCurrentTime,
  setPlaying,
  setPlaylist,
  setVolume,
  volume,
  waiting,
} from '~/composables/player'
import PlaylistBtn from './components/PlaylistBtn/PlaylistBtn.vue'
import VolumeBtn from './components/VolumeBtn.vue'

const progressBarRef = useTemplateRef('progressBarRef')
const tempProgress = ref<number | null>(null)
const scrubbing = ref(false)

const showSpinner = computed(() => waiting.value || seeking.value)

/**
 * 格式化时间为 MM:SS 格式
 */
function formatTime(seconds: number): string {
  const totalSeconds = Math.floor(seconds)
  const minutes = Math.floor(totalSeconds / 60)
  const secs = totalSeconds % 60
  return `${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
}

// 计算显示的进度（拖动时使用 tempProgress）
const displayProgress = computed(() => {
  if (tempProgress.value !== null)
    return tempProgress.value
  return progress.value
})

// 计算显示的时间（拖动时显示拖动位置的时间）
const displayTime = computed(() => {
  if (tempProgress.value !== null)
    return `${formatTime(tempProgress.value * duration.value)} / ${formatTime(duration.value)}`
  return `${formatTime(currentTime.value)} / ${formatTime(duration.value)}`
})

// 初始化音频源
onMounted(() => {
  setPlaylist([
    {
      name: 'Paza Moduless',
      artist: 'HYONNA',
      album: {
        name: 'Chaff & Dust',
        cover: '',
      },
      src: '/songs/paza-moduless.mp3',
    },
    {
      name: 'Die For You',
      artist: 'Riot Music',
      album: {
        name: 'Chaff & Dust',
        cover: '',
      },
      src: '/songs/die-for-you.mp3',
    },
    {
      name: 'Test Song Without Source',
      artist: 'Unknown Artist',
      album: {
        name: 'Unknown Album',
        cover: '',
      },
      src: '/songs/non-existent-file.mp3',
    },
  ])
  setCurrentIndex(0)
})

function updateTempProgress(clientX: number) {
  const rect = progressBarRef.value!.getBoundingClientRect()
  const progressBarWidth = rect.width
  const progressBarLeft = rect.left

  tempProgress.value = Math.max(0, Math.min(1, (clientX - progressBarLeft) / progressBarWidth))
}

function handlePointerDown(e: PointerEvent) {
  if (waiting.value)
    return
  if (e.pointerType === 'mouse' && e.button !== 0)
    return
  scrubbing.value = true
  updateTempProgress(e.clientX)
  ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
}

function handlePointerMove(e: PointerEvent) {
  if (!scrubbing.value)
    return
  updateTempProgress(e.clientX)
}

function handlePointerUp(e: PointerEvent) {
  if (waiting.value)
    return
  if (e.pointerType === 'mouse' && e.button !== 0)
    return
  if (!scrubbing.value)
    return
  scrubbing.value = false
  ;(e.target as HTMLElement).releasePointerCapture(e.pointerId)

  if (tempProgress.value !== null) {
    const newTime = tempProgress.value * duration.value
    setCurrentTime(newTime)
    tempProgress.value = null
  }
}
</script>

<template>
  <div
    :style="{
      '--progress-percent': `${displayProgress * 100}%`,
    }"
    class="flex flex-col select-none"
  >
    <!-- Progress bar -->
    <div
      ref="progressBarRef"
      class="progress-bar-wrapper py-2 cursor-pointer relative z-1 -my-2"
      @pointerdown="handlePointerDown"
      @pointermove="handlePointerMove"
      @pointerup="handlePointerUp"
      @contextmenu.prevent
    >
      <!-- Tooltip -->
      <div
        class="
          time-tooltip
          absolute text-sm text-white font-mono tabular-nums whitespace-nowrap px-2 py-1 rounded-lg bg-black/80 opacity-0 invisible pointer-events-none
          transition-[opacity,visibility] duration-200 -translate-y-full
        "
      >
        {{ displayTime }}
      </div>

      <div
        class="progress-bar bg-light-500/80 flex h-1 transition-height justify-start relative touch-none dark:bg-gray-500/70"
      >
        <div
          class="rounded-r-full bg-blue/80 h-full"
          :style="{ width: `var(--progress-percent)` }"
        />
        <div
          class="thumb rounded-full bg-blue flex h-3 w-3 transition-[opacity,visibility] duration-500 items-center top-1/2 justify-center absolute -translate-x-1/2 -translate-y-1/2"
          :style="{ left: `var(--progress-percent)` }"
        >
          <div
            :class="{
              'invisible opacity-0': !showSpinner,
            }"
            class="i-solar-refresh-bold text-2.5 text-white transition-[opacity,visibility] animate-spin"
          />
        </div>
      </div>
    </div>

    <!-- Music player -->
    <div class="@container flex h-19">
      <!-- Music image -->
      <div class="bg-gray h-full aspect-1">
        <img
          v-if="currentSong?.album?.cover"
          :src="currentSong.album.cover"
          class="h-full w-full"
        >
      </div>

      <!-- Music info -->
      <div class="mx-4 flex flex-1 flex-col gap-2 min-w-0 items-start justify-center">
        <!-- Song name -->
        <span class="text-black font-bold max-w-full min-w-0 truncate dark:text-white">
          {{ currentSong?.name || 'Unknown Song' }}
        </span>
        <!-- Artist name -->
        <span class="text-xs text-gray/80 max-w-full min-w-0 truncate">
          {{ currentSong?.artist || 'Unknown Artist' }}
        </span>
      </div>

      <!-- Extra buttons -->
      <div class="px-2 flex gap-3 items-center justify-center">
        <PlaylistBtn />
        <VolumeBtn :modelValue="volume" @update:modelValue="setVolume" />
      </div>

      <!-- Play button -->
      <div class="btn-wrapper ml-2 mr-2 flex gap-2 items-center @lg:mr-6 @md:mr-4 @lg:gap-4 @md:gap-3">
        <div class="i-solar:skip-previous-bold text-5 text-gray-600 transition-color hover:text-gray-800" @click="prevNext(0)" />
        <div class="text-9 text-gray-600 transition-[transform,color] hover:scale-110 hover:text-gray-800" :class="playing ? 'i-solar:pause-circle-bold' : 'i-solar:play-circle-bold'" @click="setPlaying(!playing)" />
        <div class="i-solar:skip-next-bold text-5 text-gray-600 transition-color hover:text-gray-800" @click="prevNext(1)" />
      </div>
    </div>
  </div>
</template>

<style scoped>
.progress-bar-wrapper {
  .time-tooltip {
    position: absolute;
    position-anchor: --thumb;
    position-area: top center;
  }
  .progress-bar {
    > .thumb {
      anchor-name: --thumb;
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
  &:hover .time-tooltip {
    opacity: 1;
    visibility: visible;
  }
}
</style>
