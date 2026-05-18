<script setup lang="ts">
defineProps<{
  triggerTag?: string
  triggerAttrs?: Record<string, any>
  contentTag?: string
  contentAttrs?: Record<string, any>
}>()

const id = useId()
const anchorName = `--popover-anchor-${id}`
const popoverRef = useTemplateRef('popoverRef') as ShallowRef<HTMLElement>

const toggle = () => popoverRef.value!.togglePopover()
const show = () => popoverRef.value!.showPopover()
const hide = () => popoverRef.value!.hidePopover()

defineExpose({ toggle, show, hide })
</script>

<template>
  <component
    :is="triggerTag || 'button'"
    v-bind="triggerAttrs"
    :popovertarget="id"
    class="popover-trigger"
    :style="{
      anchorName,
    }"
  >
    <slot name="trigger" />
  </component>

  <component
    :is="contentTag || 'div'"
    :id
    ref="popoverRef"
    popover
    class="popover-content"
    :style="{ positionAnchor: anchorName }"
    v-bind="contentAttrs"
  >
    <slot name="content" />
  </component>
</template>

<style scoped>
:where(.popover-content) {
  inset: auto;
  position: absolute;
  justify-self: anchor-center;
  inset-block-end: anchor(top);
  position-try-fallbacks: flip-block;
  transition-property: display, opacity, visibility;
  transition-timing-function: var(--un-ease, var(--default-transition-timingFunction));
  transition-duration: 0.2s;
  transition-behavior: allow-discrete;
  opacity: 0;
  @apply mb-2 p-2.5 rounded-lg bg-popover text-popover-foreground ring-1 shadow-md ring-foreground/10 outline-hidden;
  &:popover-open {
    opacity: 1;
    @starting-style {
      opacity: 0;
    }
  }
}
:where(.popover-trigger) {
  position: fixed;
}
</style>
