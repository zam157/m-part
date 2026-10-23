import { Portal } from '@solidjs/web'
import { clsx } from 'cn/lite'
import { createEffect, onCleanup, Show } from 'solid-js'
import './alert-popover.css'

export interface AlertPopoverProps {
  title: string
  /** null 关闭提示；新的消息会重新开始计时。 */
  message: string | null
  onDismiss: () => void
  action?: { label: string, onClick: () => void }
  variant?: 'default' | 'destructive'
  /** 默认 6 秒；0 表示只手动关闭。悬停和键盘操作期间暂停计时。 */
  duration?: number
  /** 模态播放器打开时，挂到对话框内以保持按钮可交互。 */
  portalMount?: HTMLElement
}

/** Shadcn Alert 样式的顶部通知，原生 Popover 保证浮层不挤压页面布局。 */
export default function AlertPopover(props: AlertPopoverProps) {
  let alertRef!: HTMLDivElement
  let timer: ReturnType<typeof setTimeout> | undefined
  let hovered = false
  let focused = false
  let active = false
  let duration = 6000

  function clearTimer() {
    clearTimeout(timer)
    timer = undefined
  }

  function startTimer() {
    clearTimer()
    if (active && duration > 0 && !hovered && !focused)
      timer = setTimeout(() => props.onDismiss(), duration)
  }

  createEffect(() => ({ message: props.message, mount: props.portalMount, duration: props.duration }), (value) => {
    active = !!value.message
    duration = value.duration ?? 6000
    if (active) {
      // Portal 更换挂载点后重新进入 top layer，不抢走当前控件的焦点。
      if (!alertRef.matches(':popover-open')) alertRef.showPopover()
      hovered = alertRef.matches(':hover')
      focused = alertRef.contains(document.activeElement)
      startTimer()
    }
    else {
      clearTimer()
      if (alertRef.matches(':popover-open')) alertRef.hidePopover()
    }
    return clearTimer
  })

  onCleanup(() => {
    clearTimer()
    if (alertRef.matches(':popover-open')) alertRef.hidePopover()
  })

  return (
    <Portal mount={props.portalMount}>
      <div
        ref={alertRef}
        popover="manual"
        role="alert"
        aria-atomic="true"
        class="alert-popover fixed [inset:auto] left-1/2 top-4 m-0 w-[min(36rem,calc(100vw-2rem))] max-w-none overflow-visible rounded-lg border border-border bg-background p-4 text-foreground shadow-lg"
        onPointerEnter={() => { hovered = true; clearTimer() }}
        onPointerLeave={() => { hovered = false; startTimer() }}
        onFocusIn={() => { focused = true; clearTimer() }}
        onFocusOut={(event) => {
          if (event.relatedTarget instanceof Node && alertRef.contains(event.relatedTarget)) return
          focused = false
          startTimer()
        }}
      >
        <div class="flex items-start gap-3">
          <span aria-hidden="true" class={clsx('mt-0.5 text-4 shrink-0', props.variant === 'destructive' ? 'i-lucide:circle-alert text-destructive' : 'i-lucide:info text-muted-foreground')} />
          <div class="min-w-0 flex-1">
            <h2 class={clsx('text-sm font-medium leading-5', props.variant === 'destructive' && 'text-destructive')}>{props.title}</h2>
            <p class="mt-1 text-sm leading-relaxed text-muted-foreground [overflow-wrap:anywhere] max-h-40 overflow-y-auto">{props.message}</p>
          </div>
          <div class="flex items-center gap-1 shrink-0">
            <Show when={props.action} keyed>{action => <button type="button" class="border-btn h-8 px-2.5" onClick={action.onClick}>{action.label}</button>}</Show>
            <button type="button" class="ghost-btn size-8 text-muted-foreground" aria-label="关闭提示" onClick={props.onDismiss}><span class="i-lucide:x text-4" /></button>
          </div>
        </div>
      </div>
    </Portal>
  )
}
