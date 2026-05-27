<script setup lang="ts">
interface Props {
  value: string
}

const props = defineProps<Props>()

const activeTab = inject<Ref<string | undefined, string>>('activeTab', computed(() => ''))

const isActive = computed(() => activeTab.value === props.value)
</script>

<template>
  <div v-show="isActive">
    <slot />
  </div>
</template>
