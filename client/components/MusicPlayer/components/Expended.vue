<script setup lang="ts">
const show = defineModel<boolean>('show', { required: true })
</script>

<template>
  <div v-show="show" class="fixed inset-0 z-50 bg-background flex flex-col">
    <div class="h-12 flex items-center px-4 py-2">
      <button class="ghost-btn size-10" @click="show = false">
        <div class="i-lucide:chevrons-down text-6" />
      </button>
    </div>
    <div class="flex-1 min-h-0 flex items-center justify-center text-sm font-medium">
      Expanded Player
    </div>
  </div>
</template>
