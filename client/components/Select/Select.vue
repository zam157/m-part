<script setup lang="ts" generic="T = any">
import type { ClassValue, StyleValue } from 'vue'
import type { GroupedOption, Option } from './type'
import Popover from '../Popover/Popover.vue'

defineOptions({ inheritAttrs: false })

const { options, renderContentFirstLoad = false } = defineProps<{
  disabled?: boolean
  placeholder?: string
  options: Option<T>[]
  groupedOptions?: GroupedOption<T>[]
  contentStyle?: StyleValue
  triggerClass?: ClassValue
  renderContentFirstLoad?: boolean
}>()
const model = defineModel<T>({ required: true })
const popoverRef = useTemplateRef('popoverRef')
const isFirstLoad = ref(true)

const selectedOption = computed(() => options.find(option => option.value === model.value))
const renderContent = computed(() => {
  if (renderContentFirstLoad)
    return true
  if (isFirstLoad.value)
    return false
  return true
})
</script>

<template>
  <Popover
    ref="popoverRef"
    triggerTag="button"
    :triggerAttrs="{
      disabled,
      type: 'button',
      class: [
        'border-btn justify-between h-full pl-2 pr-1 py-1 text-xs',
        triggerClass,
      ],
    }"
    :contentAttrs="{
      class: 'w-24 max-h-80 overflow-y-auto p-1 mt-1',
      style: [{ top: 'anchor(bottom)' }, contentStyle],
    }"
    @beforeToggle="(e) => {
      if (e.newState === 'open' && isFirstLoad)
        isFirstLoad = false
    }"
  >
    <template #trigger>
      {{ selectedOption ? selectedOption.label : (placeholder || 'Select an option') }}
      <div class="i-lucide:chevron-down text-4" />
    </template>
    <template v-if="renderContent" #content>
      <div class="flex flex-col w-full">
        <div
          v-for="(option, index) in options"
          :key="index"
          class="ghost-btn flex items-center pl-1.5 pr-8 py-1 text-sm w-full"
          :class="{
            'opacity-50 cursor-not-allowed': option.disabled,
          }"
          @click="() => {
            if (option.disabled)
              return
            model = option.value
            popoverRef!.hide()
          }"
        >
          <span class="w-full truncate">{{ option.label }}</span>
          <div v-if="model === option.value" class="i-lucide:check text-4 shrink-0 grow-0 absolute right-2" />
        </div>
      </div>
    </template>
  </Popover>
</template>
