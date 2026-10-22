import { createComponent, render } from '@solidjs/web'
import { flush } from 'solid-js'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import ContextMenu from '~/components/ContextMenu/ContextMenu'
import ContextMenuHost from '~/components/ContextMenu/ContextMenuHost'
import { activeContextMenu, closeContextMenu, contextMenuPosition } from '~/components/ContextMenu/state'

let dispose: (() => void) | undefined
let container: HTMLDivElement
let trigger: HTMLButtonElement
const select = vi.fn()

beforeEach(() => {
  select.mockReset()
  // jsdom 30.1 会按 Popover 的默认隐藏样式阻止聚焦；模拟显示时同步覆盖 display。
  // 定位 / 焦点 / 事件仍运行真实组件，不替换业务逻辑。
  const matches = HTMLElement.prototype.matches
  vi.spyOn(HTMLElement.prototype, 'matches').mockImplementation(function (this: HTMLElement, selector) {
    return selector === ':popover-open' ? this.hasAttribute('data-test-open') : matches.call(this, selector)
  })
  Object.defineProperty(HTMLElement.prototype, 'showPopover', { configurable: true, value() { this.setAttribute('data-test-open', ''); this.style.display = 'block' } })
  Object.defineProperty(HTMLElement.prototype, 'hidePopover', { configurable: true, value() { this.removeAttribute('data-test-open'); this.style.display = 'none' } })
  container = document.createElement('div')
  document.body.append(container)
  dispose = render(() => [
    createComponent(ContextMenuHost, {}),
    createComponent(ContextMenu, {
      getItems: () => [
        { id: 'next', label: '添加到下一首', onSelect: select },
        { id: 'disabled', label: '禁用操作', disabled: true, onSelect: select },
        { id: 'last', label: '末尾操作', separatorBefore: true, onSelect: select },
      ],
      children: (attrs) => {
        trigger = document.createElement('button')
        trigger.textContent = '歌曲'
        trigger.addEventListener('contextmenu', attrs.onContextMenu)
        trigger.addEventListener('keydown', attrs.onKeyDown)
        return trigger
      },
    }),
  ], container)
  flush()
})

afterEach(() => {
  closeContextMenu()
  flush()
  dispose?.()
  container.remove()
  vi.restoreAllMocks()
  Reflect.deleteProperty(HTMLElement.prototype, 'showPopover')
  Reflect.deleteProperty(HTMLElement.prototype, 'hidePopover')
})

function open() {
  const event = new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: 100, clientY: 120, button: 2 })
  trigger.dispatchEvent(event)
  flush()
  return event
}
function key(value: string) {
  document.activeElement?.dispatchEvent(new KeyboardEvent('keydown', { key: value, bubbles: true, cancelable: true }))
  flush()
}

describe('通用右键菜单', () => {
  it('抑制原生菜单，渲染操作并将焦点移入菜单', () => {
    expect(open().defaultPrevented).toBe(true)
    expect(document.querySelectorAll('[role="menu"]')).toHaveLength(1)
    expect(document.activeElement?.textContent).toContain('添加到下一首')
    expect(select).not.toHaveBeenCalled()
  })

  it('右键按下后打开，松开与 auxclick 保持菜单，后续外部按下才关闭', () => {
    trigger.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true, button: 2 }))
    open()
    // auto Popover 的原生 light-dismiss 不由 jsdom 实现，必须使用 manual，
    // 并在真实 Chrome 中用完整的右键按下 / 释放验证。
    expect(document.querySelector('[role="menu"]')?.getAttribute('popover')).toBe('manual')
    trigger.dispatchEvent(new MouseEvent('pointerup', { bubbles: true, button: 2 }))
    trigger.dispatchEvent(new MouseEvent('auxclick', { bubbles: true, button: 2 }))
    flush()
    expect(activeContextMenu()).not.toBeNull()
    expect(select).not.toHaveBeenCalled()
    document.body.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true, button: 0 }))
    flush()
    expect(activeContextMenu()).toBeNull()
  })

  it('菜单内部按下不会关闭，点击菜单项仍只执行一次', () => {
    open()
    const item = document.activeElement as HTMLButtonElement
    item.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true, button: 0 }))
    flush()
    expect(activeContextMenu()).not.toBeNull()
    item.click()
    flush()
    expect(select).toHaveBeenCalledTimes(1)
    expect(activeContextMenu()).toBeNull()
  })

  it('方向键跳过禁用项并支持首尾跳转，选择后执行一次并关闭', () => {
    open()
    key('ArrowDown')
    expect(document.activeElement?.textContent).toContain('末尾操作')
    key('ArrowDown')
    expect(document.activeElement?.textContent).toContain('添加到下一首')
    key('End')
    expect(document.activeElement?.textContent).toContain('末尾操作')
    key('Home')
    ;(document.activeElement as HTMLButtonElement).click()
    flush()
    expect(select).toHaveBeenCalledTimes(1)
    expect(activeContextMenu()).toBeNull()
  })

  it('Shift+F10 打开，Escape 关闭并恢复来源焦点', async () => {
    trigger.focus()
    trigger.dispatchEvent(new KeyboardEvent('keydown', { key: 'F10', shiftKey: true, bubbles: true, cancelable: true }))
    flush()
    expect(activeContextMenu()).not.toBeNull()
    key('Escape')
    await Promise.resolve()
    expect(activeContextMenu()).toBeNull()
    expect(document.activeElement).toBe(trigger)
  })

  it('滚动或卸载来源时关闭，关闭后不执行操作', () => {
    open()
    document.querySelector('[role="menu"]')!.dispatchEvent(new Event('scroll'))
    flush()
    expect(activeContextMenu()).not.toBeNull()
    document.dispatchEvent(new Event('scroll'))
    flush()
    expect(activeContextMenu()).toBeNull()
    open()
    dispose?.()
    dispose = undefined
    flush()
    expect(activeContextMenu()).toBeNull()
    expect(select).not.toHaveBeenCalled()
  })

  it('靠近视口右下角时保持菜单在边界内', () => {
    expect(contextMenuPosition(790, 590, 192, 80, 800, 600)).toEqual({ left: 600, top: 512 })
    expect(contextMenuPosition(-10, -10, 192, 80, 800, 600)).toEqual({ left: 8, top: 8 })
  })

  it('来源位于模态对话框内时，菜单也挂在对话框内，关闭后返回默认容器', () => {
    const dialog = document.createElement('dialog')
    dialog.open = true
    container.append(dialog)
    dialog.append(trigger)
    open()
    expect(document.querySelector('[role="menu"]')?.closest('dialog')).toBe(dialog)
    key('Escape')
    expect(document.querySelector('[role="menu"]')?.closest('dialog')).toBeNull()
  })
})
