<script setup lang="ts">
defineOptions({
  name: 'IndexPage',
})

const { t } = useI18n()
useHead({
  title: () => t('button.home'),
})
</script>

<template>
  <div>
    <MusicPlayer />
  </div>
</template>

<route lang="yaml">
meta:
  layout: home
</route>
