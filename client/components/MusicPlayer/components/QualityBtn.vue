<script setup lang="ts">
import type { MusicQuality } from '#shared/types/music-info'
import Popover from '~/components/Popover/Popover.vue'

const { qualities } = defineProps<{
  qualities: MusicQuality[]
}>()
const emit = defineEmits<{
  select: [quality: MusicQuality]
}>()
</script>

<template>
  <Popover
    :triggerAttrs="{ class: 'i-solar:high-quality-outline text-5 text-primary transition-color hover:text-primary/80' }"
    :contentAttrs="{ class: 'z-10 max-w-30 w-max max-h-80 overflow-y-auto p-1 mb-4' }"
  >
    <template #content>
      <div class="flex flex-col gap-0.5 w-full">
        <div
          v-for="quality in qualities"
          :key="quality.name"
          class="btn block px-2.5 py-1 text-sm w-full truncate"
          :class="{
            'bg-accent fw-medium text-accent-foreground': quality.active,
          }"
          @click="() => {
            if (quality.active)
              return
            emit('select', quality)
          }"
        >
          {{ quality.name }}
        </div>
      </div>
    </template>
  </Popover>
</template>
