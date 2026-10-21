import { Portal } from '@solidjs/web'
import { clsx } from 'cn/lite'
import { createEffect, For, onCleanup, Show, untrack } from 'solid-js'
import { activeContextMenu, closeContextMenu, CONTEXT_MENU_ID, contextMenuPosition } from './state'

/** 全应用只挂载一次，避免大型歌单为每一首歌曲创建浮层和全局监听。 */
export default function ContextMenuHost() {
  let menuRef!: HTMLDivElement
  const enabledItems = () => [...menuRef.querySelectorAll<HTMLButtonElement>('button[role="menuitem"]:not(:disabled)')]
  const dismiss = () => closeContextMenu()
  const handleOutsidePointerDown = (event: PointerEvent) => {
    if (!event.composedPath().includes(menuRef))
      dismiss()
  }
  const handleScroll = (event: Event) => {
    if (event.target instanceof Node && menuRef.contains(event.target))
      return
    dismiss()
  }

  createEffect(activeContextMenu, (menu) => {
    if (!menu) {
      if (menuRef.matches(':popover-open'))
        menuRef.hidePopover()
      return
    }
    menuRef.showPopover()
    const rect = menuRef.getBoundingClientRect()
    const position = contextMenuPosition(menu.x, menu.y, rect.width, rect.height, window.innerWidth, window.innerHeight)
    menuRef.style.left = `${position.left}px`
    menuRef.style.top = `${position.top}px`
    untrack(() => (enabledItems()[0] ?? menuRef).focus({ preventScroll: true }))
    document.addEventListener('pointerdown', handleOutsidePointerDown, true)
    document.addEventListener('scroll', handleScroll, true)
    window.addEventListener('resize', dismiss)
    return () => {
      document.removeEventListener('pointerdown', handleOutsidePointerDown, true)
      document.removeEventListener('scroll', handleScroll, true)
      window.removeEventListener('resize', dismiss)
    }
  })
  onCleanup(dismiss)

  function handleKeyDown(event: KeyboardEvent) {
    if (event.key === 'Escape' || event.key === 'Tab') {
      event.preventDefault()
      event.stopPropagation()
      closeContextMenu(undefined, true)
      return
    }
    const items = enabledItems()
    const current = items.indexOf(document.activeElement as HTMLButtonElement)
    let next: number
    if (event.key === 'ArrowDown')
      next = (current + 1) % items.length
    else if (event.key === 'ArrowUp')
      next = (current - 1 + items.length) % items.length
    else if (event.key === 'Home')
      next = 0
    else if (event.key === 'End')
      next = items.length - 1
    else
      return
    event.preventDefault()
    event.stopPropagation()
    items[next]?.focus({ preventScroll: true })
  }

  return (
    <Portal>
      <div
        id={CONTEXT_MENU_ID}
        ref={menuRef}
        // 原生 auto 会在打开菜单的同一次右键释放时 light-dismiss。
        // 保留 top layer，外部关闭只监听后续 pointerdown，不监听 pointerup。
        popover="manual"
        role="menu"
        aria-label={activeContextMenu()?.label ?? '操作菜单'}
        tabindex={-1}
        class="fixed [inset:auto] m-0 z-50 w-48 max-w-[calc(100vw-16px)] max-h-[calc(100dvh-16px)] overflow-y-auto rounded-md border border-border bg-popover p-1 text-popover-foreground shadow-md outline-none"
        onKeyDown={handleKeyDown}
        onContextMenu={event => event.preventDefault()}
        onToggle={(event) => {
          if (event.newState === 'closed' && !menuRef.matches(':popover-open'))
            dismiss()
        }}
      >
        <For each={activeContextMenu()?.items ?? []}>{item => (
          <>
            <Show when={item.separatorBefore}><div role="separator" class="-mx-1 my-1 h-px bg-border" /></Show>
            <button
              type="button"
              role="menuitem"
              tabindex={-1}
              disabled={item.disabled}
              class={clsx('relative flex w-full cursor-default items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none select-none hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground disabled:pointer-events-none disabled:opacity-50', item.destructive && 'text-destructive hover:bg-destructive/10 hover:text-destructive focus:bg-destructive/10 focus:text-destructive')}
              onPointerMove={event => !item.disabled && event.currentTarget.focus({ preventScroll: true })}
              onClick={(event) => {
                event.stopPropagation()
                closeContextMenu(undefined, true)
                item.onSelect()
              }}
            >
              <Show when={item.icon}><span class={clsx(item.icon, 'text-4 shrink-0 text-muted-foreground')} /></Show>
              <span class="flex-1 text-left">{item.label}</span>
              <Show when={item.shortcut}><span class="ml-auto text-xs tracking-widest text-muted-foreground">{item.shortcut}</span></Show>
            </button>
          </>
        )}</For>
      </div>
    </Portal>
  )
}
