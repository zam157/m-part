<script lang="ts" setup>
import { provide, useAttrs } from 'vue'
import { useId } from 'radix-vue'
import { FORM_ITEM_INJECTION_KEY } from './useFormField'
import { cn } from '@/lib/utils'

defineOptions({
  inheritAttrs: false,
})

const id = useId()
provide(FORM_ITEM_INJECTION_KEY, id)

const { class: className, ...rest } = useAttrs()
</script>

<template>
  <div :class="cn('space-y-2', className ?? '')" v-bind="rest">
    <slot />
  </div>
</template>
