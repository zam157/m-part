<script setup lang="ts">
import { colorMode, switchColorMode } from '~/composables/dark'

defineOptions({
  name: 'IndexPage',
})
</script>

<template>
  <div class="flex-1 min-w-0" @click="switchColorMode(colorMode === 'light' ? 'dark' : 'light')">
    colorMode: {{ colorMode }}
  </div>
</template>
