import type { JSX } from '@solidjs/web'
import { Dynamic, Portal } from '@solidjs/web'
import { clsx } from 'cn/lite'
import { createUniqueId, Show } from 'solid-js'
import './popover.css'

export interface PopoverApi {
  toggle: () => void
  show: () => void
  hide: () => void
}

export interface PopoverTriggerProps {
  ref: (element: HTMLElement) => void
  popovertarget: string | undefined
}

export interface PopoverProps {
  /** Custom trigger without introducing an extra element. */
  renderTrigger?: (props: PopoverTriggerProps) => JSX.Element
  /** Manual triggers use the exposed API instead of native click toggling. */
  triggerMode?: 'click' | 'manual'
  contentId?: string
  /** popover 属性，默认 `auto` */
  popover?: 'auto' | 'hint' | 'manual'
  /** 触发器标签名，默认 `button` */
  triggerTag?: string
  /** 触发器的附加属性，原样透传 */
  triggerAttrs?: Record<string, any>
  /** 内容容器标签名，默认 `div` */
  contentTag?: string
  /** 弹出容器的附加属性，原样透传（`class` 会与内置类名拼接） */
  contentAttrs?: Record<string, any>
  onBeforeToggle?: (event: ToggleEvent) => void
  /** 触发器内容 */
  trigger?: JSX.Element
  /** 弹出内容 */
  content?: JSX.Element
  /** 通过 ref 暴露命令式 API（替代 Vue 的 defineExpose） */
  ref?: (api: PopoverApi) => void
}

/**
 * 基于原生 Popover API 的浮层。
 *
 * 定位全部交给 CSS（见 `popover.css`）：`popovertarget` + `id` 已经把触发器和浮层
 * 关联成「隐式锚点」，浮层上的 `position-anchor: auto` 指的就是它。所以这里不需要
 * 动态的 `anchor-name` / `position-anchor` 行内样式，只需要一个唯一 id。
 */
export default function Popover(props: PopoverProps) {
  const generatedId = createUniqueId()
  const popoverId = () => props.contentId ?? generatedId
  let popoverRef: HTMLElement | undefined
  let triggerRef: HTMLElement | undefined

  props.ref?.({
    // 命令式打开不经过触发器的激活流程，显式给出 source 才能保留隐式锚点
    toggle: () => popoverRef?.togglePopover({ source: triggerRef }),
    show: () => popoverRef?.showPopover({ source: triggerRef }),
    hide: () => popoverRef?.hidePopover(),
  })

  return (
    <>
      <Show when={props.renderTrigger} keyed fallback={(
        <Dynamic
          component={props.triggerTag ?? 'button'}
          {...(props.triggerAttrs ?? {})}
          ref={triggerRef}
          popovertarget={props.triggerMode === 'manual' ? undefined : popoverId()}
        >
          {props.trigger}
        </Dynamic>
      )}>
        {renderTrigger => renderTrigger({
          ref: element => (triggerRef = element),
          get popovertarget() {
            return props.triggerMode === 'manual' ? undefined : popoverId()
          },
        })}
      </Show>

      <Portal>
        <Dynamic
          component={props.contentTag ?? 'div'}
          {...(props.contentAttrs ?? {})}
          id={popoverId()}
          popover={props.popover ?? 'auto'}
          ref={popoverRef}
          class={clsx('t-popover-content', props.contentAttrs?.class)}
          onBeforeToggle={props.onBeforeToggle}
        >
          {props.content}
        </Dynamic>
      </Portal>
    </>
  )
}
