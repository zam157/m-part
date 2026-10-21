import { createSignal, untrack } from 'solid-js'

export interface ContextMenuItem {
  id: string
  label: string
  icon?: string
  shortcut?: string
  disabled?: boolean
  destructive?: boolean
  separatorBefore?: boolean
  onSelect: () => void
}

export interface OpenContextMenu {
  owner: symbol
  origin: HTMLElement
  x: number
  y: number
  label: string
  items: readonly ContextMenuItem[]
}

export const CONTEXT_MENU_ID = 'mpart-context-menu'
const [activeContextMenu, setActiveContextMenu] = createSignal<OpenContextMenu | null>(null)
export { activeContextMenu }

export function openContextMenu(menu: OpenContextMenu) {
  setActiveContextMenu(menu)
}

export function closeContextMenu(owner?: symbol, restoreFocus = false) {
  const menu = untrack(activeContextMenu)
  if (!menu || owner && menu.owner !== owner)
    return
  setActiveContextMenu(null)
  if (restoreFocus)
    queueMicrotask(() => menu.origin.isConnected && menu.origin.focus({ preventScroll: true }))
}

export function contextMenuPosition(x: number, y: number, width: number, height: number, viewportWidth: number, viewportHeight: number) {
  return { left: Math.max(8, Math.min(x, viewportWidth - width - 8)), top: Math.max(8, Math.min(y, viewportHeight - height - 8)) }
}
