<script setup lang="ts" generic="T extends string">
interface Tab {
  value: T
  label: string
}

interface Props {
  tabs: Tab[]
  modelValue?: T
  disabled?: boolean
}

defineOptions({ inheritAttrs: false })
const props = defineProps<Props>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: T): void
}>()

const activeTab = computed({
  get: () => props.modelValue || props.tabs[0]?.value,
  set: (value: T) => emit('update:modelValue', value),
})

provide('activeTab', activeTab)

function handleTabClick(tabValue: T) {
  if (!props.disabled) {
    activeTab.value = tabValue
  }
}
</script>

<template>
  <!-- Tab List -->
  <div
    class="uno-layer-components:(flex gap-1 rounded-lg bg-muted p-[3px] w-fit)"
    role="tablist"
    v-bind="$attrs"
  >
    <button
      v-for="tab in tabs"
      :key="tab.value"
      :aria-selected="activeTab === tab.value"
      :disabled="disabled"
      role="tab"
      class="uno-layer-components:(px-1.5 py-0.5 text-sm font-medium transition-all rounded-md outline-none)"
      :class="[
        activeTab === tab.value
          ? 'uno-layer-components:(bg-background text-foreground shadow-sm)'
          : 'uno-layer-components:(text-muted-foreground hover:text-foreground)',
        disabled && 'uno-layer-components:(cursor-not-allowed opacity-50)',
      ]"
      @click="handleTabClick(tab.value)"
    >
      {{ tab.label }}
    </button>
  </div>

  <!-- Slot for tab content -->
  <slot />
</template>
