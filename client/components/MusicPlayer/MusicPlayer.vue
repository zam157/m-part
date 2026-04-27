<script setup lang="ts">
import {
  currentSong,
  currentTime,
  duration,
  playing,
  playlist,
  playMode,
  prevNext,
  progress,
  seeking,
  setCurrentTime,
  setPlaying,
  setVolume,
  showPlaylist,
  togglePlayMode,
  volume,
  waiting,
} from '~/composables/player'
import VolumeBtn from './components/VolumeBtn.vue'

const progressBarRef = useTemplateRef('progressBarRef')
const tempProgress = ref<number | null>(null)
const scrubbing = ref(false)

// 缓存进度条容器元素大小信息
const progressBarRect = shallowRef<{ width: number, left: number } | null>(null)

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
    return `${formatTime(tempProgress.value * duration.value)}/${formatTime(duration.value)}`
  return `${formatTime(currentTime.value)}/${formatTime(duration.value)}`
})

function updateTempProgress(clientX: number) {
  const rect = progressBarRect.value
  if (!rect)
    return

  const { width, left } = rect
  tempProgress.value = Math.max(0, Math.min(1, (clientX - left) / width))
}

function handlePointerDown(e: PointerEvent) {
  if (waiting.value)
    return
  if (e.pointerType === 'mouse' && e.button !== 0)
    return
  scrubbing.value = true
  // 在 pointerdown 时缓存进度条位置，避免频繁的 getBoundingClientRect 调用
  const rect = progressBarRef.value!.getBoundingClientRect()
  progressBarRect.value = {
    width: rect.width,
    left: rect.left,
  }
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

  // 清除缓存的位置信息
  progressBarRect.value = null
}
</script>

<template>
  <div
    :style="{
      '--progress-percent': `${displayProgress * 100}%`,
    }"
    :class="{
      'translate-y-full hidden': playlist.length === 0,
    }"
    class="
      grow-0 shrink-0 flex flex-col select-none relative
      transition-[transform,display] transition-discrete starting:translate-y-full
    "
  >
    <!-- Progress bar -->
    <div class="relative h-1">
      <div
        ref="progressBarRef"
        class="progress-bar-wrapper cursor-pointer absolute bottom-0 left-0 w-full z-1"
        @pointerdown="handlePointerDown"
        @pointermove="handlePointerMove"
        @pointerup="handlePointerUp"
        @contextmenu.prevent
      >
        <!-- Tooltip -->
        <div
          v-if="duration"
          class="
            time-tooltip
            absolute text-sm text-neutral-50 font-mono whitespace-nowrap px-2 py-1 rounded-lg bg-neutral-700 opacity-0 invisible pointer-events-none
            transition-[opacity,visibility] duration-200 -translate-y-full
          "
        >
          {{ displayTime }}
        </div>

        <div
          class="progress-bar h-1 transition-height duration-300 relative touch-none bg-neutral-200 dark:bg-neutral-500"
          :class="{
            't-loading': showSpinner,
          }"
        >
          <div
            class="rounded-r-full bg-primary h-full"
            :style="{ width: `var(--progress-percent)` }"
          />
          <div
            :class="scrubbing ? 'h-4 w-6 bg-primary/30' : 'bg-primary size-3.5'"
            class="
              thumb
              rounded-full flex items-center justify-center size-3.5 shadow-md
              transition-[opacity,visibility,height,width,background-color] duration-500
              top-1/2 absolute -translate-x-1/2 -translate-y-1/2
            "
            :style="{ left: `var(--progress-percent)` }"
          >
            <div
              :class="{
                'hidden opacity-0': !showSpinner,
              }"
              class="i-solar-refresh-bold text-2.5 text-primary-foreground transition-[opacity,display] transition-discrete starting:opacity-0 animate-spin"
            />
          </div>
        </div>
      </div>
    </div>

    <!-- Music player -->
    <div class="@container flex h-19">
      <!-- Music image -->
      <div class="dark:bg-neutral-200 bg-neutral-500 h-full aspect-1">
        <img
          v-if="currentSong?.album?.cover"
          :src="currentSong.album.cover"
          class="h-full w-full"
        >
      </div>

      <!-- Music info -->
      <div class="mx-4 flex flex-1 flex-col gap-2 min-w-0 items-start justify-center">
        <!-- Song name -->
        <span class="text-primary font-bold max-w-full min-w-0 truncate">
          {{ currentSong?.name || 'Unknown Song' }}
        </span>
        <!-- Artist name -->
        <span class="text-xs text-zinc-400 max-w-full min-w-0 truncate">
          {{ currentSong?.artist || 'Unknown Artist' }}
        </span>
      </div>

      <!-- Extra buttons -->
      <div class="px-2 flex gap-4 items-center justify-center">
        <div
          class="i-solar-playlist-bold text-5 text-primary transition-color hover:text-primary/80"
          @click="showPlaylist = !showPlaylist"
        />
        <div
          :class="{
            'i-solar-repeat-bold': playMode === 'loop',
            'i-solar:shuffle-linear': playMode === 'random',
            'i-solar:list-down-minimalistic-bold': playMode === 'order',
          }"
          class="text-5 text-primary transition-color hover:text-primary/80"
          @click="togglePlayMode"
        />
        <VolumeBtn :modelValue="volume" @update:modelValue="setVolume" />
      </div>

      <!-- Play button -->
      <div class="btn-wrapper ml-2 mr-2 flex gap-2 items-center @lg:mr-6 @md:mr-4 @lg:gap-4 @md:gap-3">
        <div class="i-solar:skip-previous-bold text-5 text-primary transition-color hover:text-primary/80" @click="prevNext(0)" />
        <div class="text-9 text-primary transition-[transform,color] hover:scale-110 hover:text-primary/80" :class="playing ? 'i-solar:pause-circle-bold' : 'i-solar:play-circle-bold'" @click="setPlaying(!playing)" />
        <div class="i-solar:skip-next-bold text-5 text-primary transition-color hover:text-primary/80" @click="prevNext(1)" />
      </div>
    </div>
  </div>
</template>

<style scoped>
.progress-bar-wrapper {
  .time-tooltip {
    position: absolute;
    position-anchor: --thumb;
    justify-self: anchor-center;
    inset-block-start: calc(anchor(top) - 1.5 * var(--spacing));
  }
  .progress-bar {
    > .thumb {
      anchor-name: --thumb;
      visibility: hidden;
      opacity: 0;
    }
  }
  &:hover .progress-bar,
  .t-loading.progress-bar {
    height: calc(var(--spacing) * 2);
    > .thumb {
      visibility: visible;
      opacity: 1;
    }
  }
  &:hover .time-tooltip {
    opacity: 1;
    visibility: visible;
  }
  /** Extra hover area */
  &::after {
    content: '';
    position: absolute;
    top: 50%;
    left: 0;
    width: 100%;
    height: calc(4 * var(--spacing) + 100%);
    transform: translateY(-50%);
  }
}
</style>
