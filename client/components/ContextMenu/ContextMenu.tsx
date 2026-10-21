import type { JSX } from '@solidjs/web'
import { onCleanup } from 'solid-js'
import type { ContextMenuItem } from './state'
import { activeContextMenu, closeContextMenu, CONTEXT_MENU_ID, openContextMenu } from './state'

export interface ContextMenuTriggerProps {
  tabindex: number
  'aria-haspopup': 'menu'
  'aria-controls': string
  'aria-expanded': 'true' | 'false'
  onContextMenu: (event: MouseEvent) => void
  onKeyDown: (event: KeyboardEvent) => void
}

export interface ContextMenuProps {
  getItems: () => readonly ContextMenuItem[]
  label?: string
  children: (props: ContextMenuTriggerProps) => JSX.Element
}

/** 将 trigger props 转发到现有元素，不增加包装节点；浮层由共享 Host 渲染。 */
export default function ContextMenu(props: ContextMenuProps) {
  const owner = Symbol('context-menu')
  onCleanup(() => closeContextMenu(owner))

  function open(origin: HTMLElement, x: number, y: number) {
    const items = props.getItems()
    if (!items.length)
      return false
    openContextMenu({ owner, origin, x, y, items, label: props.label ?? '操作菜单' })
    return true
  }

  return props.children({
    tabindex: 0,
    'aria-haspopup': 'menu',
    'aria-controls': CONTEXT_MENU_ID,
    get 'aria-expanded'() { return activeContextMenu()?.owner === owner ? 'true' : 'false' },
    onContextMenu: (event) => {
      if (open(event.currentTarget as HTMLElement, event.clientX, event.clientY)) {
        event.preventDefault()
        event.stopPropagation()
      }
    },
    onKeyDown: (event) => {
      if (event.key !== 'ContextMenu' && !(event.shiftKey && event.key === 'F10'))
        return
      const origin = event.currentTarget as HTMLElement
      const rect = origin.getBoundingClientRect()
      if (open(origin, rect.left, rect.bottom)) {
        event.preventDefault()
        event.stopPropagation()
      }
    },
  })
}
