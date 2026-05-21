<script setup lang="ts">
defineProps<{
  triggerTag?: string
  triggerAttrs?: Record<string, any>
  contentTag?: string
  contentAttrs?: Record<string, any>
}>()

const id = useId()
const anchorName = `--popover-anchor-${id}`
const popoverId = `popover-${id}`
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
    :popovertarget="popoverId"
    class="t-popover-trigger"
    :style="{
      anchorName,
    }"
  >
    <slot name="trigger" />
  </component>

  <component
    :is="contentTag || 'div'"
    :id="popoverId"
    ref="popoverRef"
    popover
    class="t-popover-content"
    :style="{ positionAnchor: anchorName }"
    v-bind="contentAttrs"
  >
    <slot name="content" />
  </component>
</template>

<style>
@layer components {
  .t-popover-content {
    @apply mb-2 p-2.5 rounded-lg bg-popover text-popover-foreground ring-1 shadow-md ring-foreground/10 outline-hidden;
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
    &:popover-open {
      opacity: 1;
      @starting-style {
        opacity: 0;
      }
    }
  }
}
</style>
