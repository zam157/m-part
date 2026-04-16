<script setup lang="ts">
import { colorMode, switchColorMode } from '~/composables/dark'

defineOptions({
  name: 'IndexPage',
})
</script>

<template>
  <div @click="switchColorMode(colorMode === 'light' ? 'dark' : 'light')">
    colorMode: {{ colorMode }}
  </div>
</template>
