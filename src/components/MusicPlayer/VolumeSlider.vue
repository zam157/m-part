<script setup lang="ts">
const value = defineModel<number>({
  default: 0,
})

const containerRef = useTemplateRef('containerRef')
const volumeIconRef = useTemplateRef('volumeIconRef')
const sliderRef = useTemplateRef('sliderRef')
const isDragging = ref(false)
const isHovering = ref(false)
const volumeBeforeMuted = ref(0)

let closeTimer: ReturnType<typeof setTimeout> | null = null
function setTimer() {
  closeTimer = setTimeout(() => {
    isHovering.value = false
    closeTimer = null
  }, 300)
}
function updateVolume(clientY: number) {
  if (!sliderRef.value)
    return
  const rect = sliderRef.value.getBoundingClientRect()
  const progress = 1 - Math.max(0, Math.min(1, (clientY - rect.top) / rect.height))
  value.value = progress
}

// #region 弹窗事件处理
function handleMouseEnter() {
  if (closeTimer) {
    clearTimeout(closeTimer)
    closeTimer = null
  }
  isHovering.value = true
}
function handleMouseLeave() {
  if (isDragging.value)
    return

  if (closeTimer) {
    clearTimeout(closeTimer)
    closeTimer = null
  }
  setTimer()
}
function handleVolumeIconClick(e: PointerEvent) {
  const pointerType = e.pointerType
  if (pointerType === 'mouse') {
    if (value.value === 0) {
      value.value = volumeBeforeMuted.value
    }
    else {
      volumeBeforeMuted.value = value.value
      value.value = 0
    }

    return
  }
  handleVolumeIconTouchStart()
}
function handleVolumeIconTouchStart() {
  isHovering.value = !isHovering.value
  function closeEvent(event: MouseEvent) {
    if (!volumeIconRef.value || event.target === volumeIconRef.value || containerRef.value?.contains(event.target as Node))
      return
    isHovering.value = false
  }
  if (isHovering.value) {
    addEventListener('click', closeEvent)
  }
  else {
    removeEventListener('click', closeEvent)
  }
}
// #endregion

function dragStart(e: PointerEvent) {
  isDragging.value = true

  // 捕获确保即使指针离开元素也能继续接收事件
  ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
  updateVolume(e.clientY)
}

function onPointerMove(e: PointerEvent) {
  if (!isDragging.value)
    return
  updateVolume(e.clientY)
}

function onPointerUp(e: PointerEvent) {
  if (!isDragging.value)
    return
  isDragging.value = false

  // 释放捕获
  ;(e.target as HTMLElement).releasePointerCapture(e.pointerId)

  if (containerRef.value && !containerRef.value.contains(e.target as Node))
    setTimer()
}

const volumeIcon = computed(() => {
  if (value.value === 0)
    return 'i-solar:volume-bold'
  if (value.value < 0.5)
    return 'i-solar:volume-small-bold-duotone'
  return 'i-solar:volume-loud-bold-duotone'
})
</script>

<template>
  <div
    ref="containerRef"
    class="flex relative"
    @mouseenter="handleMouseEnter"
    @mouseleave="handleMouseLeave"
  >
    <div
      ref="volumeIconRef"
      :class="volumeIcon"
      class="text-5 cursor-pointer"
      @pointerup="handleVolumeIconClick"
    />

    <Transition
      enter-active-class="transition duration-200 ease-out"
      enter-from-class="transform translate-y-2 opacity-0"
      enter-to-class="transform translate-y-0 opacity-100"
      leave-active-class="transition duration-150 ease-in"
      leave-from-class="transform translate-y-0 opacity-100"
      leave-to-class="transform translate-y-2 opacity-0"
    >
      <div
        v-show="isHovering"
        class="mb-2 pb-1.5 pt-3 rounded-lg bg-white flex flex-col w-9 shadow-lg items-center bottom-full left-1/2 justify-center absolute dark:bg-dark -translate-x-1/2"
      >
        <div
          ref="sliderRef"
          class="rounded-full bg-gray/20 h-24 w-1.5 cursor-pointer relative touch-none"
          @pointerdown="dragStart"
          @pointermove="onPointerMove"
          @pointerup="onPointerUp"
        >
          <div
            class="rounded-full bg-blue/70 w-full transition-height duration-50 transition-ease-linear bottom-0 absolute"
            :style="{ height: `${value * 100}%` }"
          />
          <div
            class="rounded-full bg-blue h-3 w-3 shadow-2xl translate-y-1/2 transition-transform left-1/2 absolute -translate-x-1/2 hover:scale-110"
            :style="{ bottom: `${value * 100}%` }"
          />
        </div>
        <div class="text-2.5 mt-1">
          {{ Math.round(value * 100) }}%
        </div>
        <div class="bg-white h-2 w-2 rotate-45 left-1/2 absolute dark:bg-dark -translate-x-1/2 -bottom-1" />
      </div>
    </Transition>
  </div>
</template>
