import type { JSX } from '@solidjs/web'
import { clsx } from 'cn/lite'
import { createEffect, onCleanup, Show } from 'solid-js'

export interface DialogProps {
  open: boolean
  onClose: () => void
  children?: JSX.Element
  size?: 'sm' | 'md' | 'lg'
  fullScreen?: boolean
  id?: string
  class?: string
  'aria-label'?: string
  'aria-labelledby'?: string
  'aria-describedby'?: string
  ref?: (element: HTMLDialogElement) => void
  onKeyDown?: (event: KeyboardEvent) => void
}

const widths = {
  sm: 'w-[min(28rem,calc(100vw-2rem))]',
  md: 'w-[min(32rem,calc(100vw-2rem))]',
  lg: 'w-[min(42rem,calc(100vw-2rem))]',
}

/** Controlled native modal. The browser owns focus trapping and focus restoration. */
export default function Dialog(props: DialogProps) {
  let dialog!: HTMLDialogElement
  let disposing = false
  function closeNative() {
    for (const popover of dialog.querySelectorAll<HTMLElement>('[popover]'))
      popover.hidePopover?.()
    dialog.close()
  }
  createEffect(() => props.open, (open) => {
    if (open && !dialog.open) dialog.showModal()
    else if (!open && dialog.open) closeNative()
  })
  onCleanup(() => {
    disposing = true
    if (dialog.open) closeNative()
  })
  return (
    <dialog
      ref={element => { dialog = element; props.ref?.(element) }}
      id={props.id}
      aria-label={props['aria-label']}
      aria-labelledby={props['aria-labelledby']}
      aria-describedby={props['aria-describedby']}
      aria-modal="true"
      inert={!props.open}
      class={clsx('fixed m-0 flex-col overflow-hidden bg-background p-0 text-foreground outline-none',
        props.fullScreen
          ? 'inset-0 w-full h-100dvh max-w-none max-h-none border-0'
          : clsx('open:flex [inset:auto] left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 max-w-none max-h-[calc(100svh-2rem)] rounded-xl border border-border shadow-sm backdrop:bg-black/20', widths[props.size ?? 'sm']),
        props.class)}
      onCancel={event => { event.preventDefault(); props.onClose() }}
      onClose={() => { if (!disposing && !dialog.open && props.open) props.onClose() }}
      onKeyDown={event => props.onKeyDown?.(event)}
    >
      {props.children}
    </dialog>
  )
}

export function DialogHeader(props: {
  title: JSX.Element
  titleId: string
  description?: JSX.Element
  descriptionId?: string
  closeLabel?: string
  onClose: () => void
}) {
  return (
    <header data-slot="dialog-header" class="relative shrink-0 px-4 pt-4 pb-3 pe-12">
      <div class="min-w-0 grid gap-1">
        <h2 id={props.titleId} class="text-base font-medium">{props.title}</h2>
        <Show when={props.description}><p id={props.descriptionId} class="truncate text-sm text-muted-foreground">{props.description}</p></Show>
      </div>
      <button type="button" data-slot="dialog-close" class="ghost-btn absolute top-3 right-3 size-6" aria-label={props.closeLabel ?? '关闭弹窗'} onClick={() => props.onClose()}>
        <span aria-hidden="true" class="i-lucide:x text-4" />
      </button>
    </header>
  )
}

export function DialogBody(props: { children?: JSX.Element, class?: string, 'aria-label'?: string }) {
  return <div data-slot="dialog-body" aria-label={props['aria-label']} class={clsx('min-h-0 overflow-y-auto px-4 pb-4', props.class)}>{props.children}</div>
}

export function DialogFooter(props: { children?: JSX.Element, class?: string }) {
  return <footer data-slot="dialog-footer" class={clsx('shrink-0 flex flex-wrap items-center gap-2 border-t border-border bg-muted/40 px-4 py-3', props.class)}>{props.children}</footer>
}
