import type { JSX } from '@solidjs/web'
import { Dynamic, Portal } from '@solidjs/web'
import { createUniqueId } from 'solid-js'
import './popover.css'

export interface PopoverApi {
  toggle: () => void
  show: () => void
  hide: () => void
}

/**
 * 合并 class / style 两个「可叠加」属性，其余属性原样透传。
 * Solid 不会像 Vue 那样自动合并 class，所以需要显式处理。
 */
function splitBoundAttrs(attrs: Record<string, any> | undefined, defaults: Record<string, any>) {
  const { class: className, style, ...rest } = attrs ?? {}
  const merged: Record<string, any> = { ...rest, ...defaults }
  if ('class' in defaults) {
    merged.class = `${defaults.class} ${className ?? ''}`.trim()
  }
  else if (className !== undefined) {
    merged.class = className
  }
  if ('style' in defaults) {
    merged.style = typeof style === 'string'
      ? `${defaults.style as string}${style}`
      : { ...(defaults.style as object), ...(style ?? {}) }
  }
  else if (style !== undefined) {
    merged.style = style
  }
  return merged
}

export interface PopoverProps {
  /** popover 属性，默认 `auto`（等价于 Vue 版的 `popover=""`） */
  popover?: 'auto' | 'hint' | 'manual'
  /** 触发器标签名，默认 `button` */
  triggerTag?: string
  /** 触发器上的附加属性（class / style 会与内置样式合并） */
  triggerAttrs?: Record<string, any>
  /** 内容容器标签名，默认 `div` */
  contentTag?: string
  /** 内容容器上的附加属性（class / style 会与内置样式合并） */
  contentAttrs?: Record<string, any>
  onBeforeToggle?: (event: ToggleEvent) => void
  /** 触发器内容 */
  trigger?: JSX.Element
  /** 弹出内容 */
  content?: JSX.Element
  /** 通过 ref 暴露命令式 API（替代 Vue 的 defineExpose） */
  ref?: (api: PopoverApi) => void
}

export default function Popover(props: PopoverProps) {
  const id = createUniqueId()
  const anchorName = `--popover-anchor-${id}`
  const popoverId = `popover-${id}`

  let popoverRef: HTMLElement | undefined

  props.ref?.({
    toggle: () => popoverRef?.togglePopover(),
    show: () => popoverRef?.showPopover(),
    hide: () => popoverRef?.hidePopover(),
  })

  const triggerProps = () => splitBoundAttrs(props.triggerAttrs, {
    popovertarget: popoverId,
    class: 't-popover-trigger',
    style: `anchor-name:${anchorName};`,
  })

  const contentProps = () => splitBoundAttrs(props.contentAttrs, {
    id: popoverId,
    popover: props.popover ?? 'auto',
    class: 't-popover-content',
    style: `position-anchor:${anchorName};`,
    onBeforeToggle: props.onBeforeToggle,
  })

  return (
    <>
      <Dynamic component={props.triggerTag ?? 'button'} {...(triggerProps() as any)}>
        {props.trigger}
      </Dynamic>

      <Portal>
        <Dynamic component={props.contentTag ?? 'div'} ref={popoverRef} {...(contentProps() as any)}>
          {props.content}
        </Dynamic>
      </Portal>
    </>
  )
}
