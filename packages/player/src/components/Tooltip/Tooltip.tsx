import type { JSX } from '@solidjs/web'
import { mergeProps } from '@solidjs/web'
import type { PopoverApi, PopoverTriggerProps } from '~/components/Popover/Popover'
import { clsx } from 'cn/lite'
import { createEffect, createSignal, createUniqueId } from 'solid-js'
import Popover from '~/components/Popover/Popover'
import './tooltip.css'

export interface TooltipTriggerProps extends PopoverTriggerProps {
  'aria-describedby': string | undefined
  onMouseEnter: () => void
  onMouseLeave: () => void
  onFocus: () => void
  onBlur: () => void
  onKeyDown: (event: KeyboardEvent) => void
}

export interface TooltipProps {
  portalMount?: HTMLElement
  content: JSX.Element
  disabled?: boolean
  placement?: 'top' | 'right' | 'bottom' | 'left'
  offset?: number
  class?: string
  children: (props: TooltipTriggerProps) => JSX.Element
}

/** Spread trigger props onto the focusable element, preserving its accessible name. */
export default function Tooltip(props: TooltipProps) {
  const id = createUniqueId()
  const [open, setOpen] = createSignal(false)
  let popover: PopoverApi | undefined
  const hide = () => popover?.hide()
  const show = () => {
    if (!props.disabled)
      popover?.show()
  }

  createEffect(() => props.disabled, (disabled) => {
    if (disabled)
      hide()
  })

  createEffect(open, (isOpen) => {
    if (!isOpen)
      return
    document.addEventListener('click', hide, true)
    window.addEventListener('resize', hide)
    window.addEventListener('scroll', hide, true)
    return () => {
      document.removeEventListener('click', hide, true)
      window.removeEventListener('resize', hide)
      window.removeEventListener('scroll', hide, true)
    }
  })

  return (
    <Popover
      portalMount={props.portalMount}
      ref={api => (popover = api)}
      contentId={id}
      popover="manual"
      triggerMode="manual"
      renderTrigger={anchor => props.children(mergeProps(anchor, {
        get 'aria-describedby'() { return open() && !props.disabled ? id : undefined },
        onMouseEnter: show,
        onMouseLeave: hide,
        onFocus: show,
        onBlur: hide,
        onKeyDown: (event: KeyboardEvent) => event.key === 'Escape' && hide(),
      }))}
      contentAttrs={{
        role: 'tooltip',
        get class() { return clsx('t-tooltip fixed m-0 px-2.5 py-1.5 rounded-[6px] max-w-[calc(100vw-16px)] text-xs leading-normal [overflow-wrap:anywhere] pointer-events-none', props.class) },
        get 'data-placement'() { return props.placement ?? 'top' },
        get style() { return { '--tooltip-offset': `${props.offset ?? 8}px` } },
      }}
      onBeforeToggle={event => setOpen(event.newState === 'open')}
      content={props.content}
    />
  )
}
