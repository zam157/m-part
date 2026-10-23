import { createComponent, render } from '@solidjs/web'
import { createSignal, flush } from 'solid-js'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import AlertPopover from '~/components/AlertPopover/AlertPopover'

const [message, setMessage] = createSignal<string | null>(null)
const [mount, setMount] = createSignal<HTMLElement | undefined>()
let container: HTMLDivElement
let dialog: HTMLDialogElement
let trigger: HTMLButtonElement
let dispose: (() => void) | undefined
const action = vi.fn()
const dismiss = vi.fn(() => setMessage(null))
const alert = () => document.querySelector<HTMLDivElement>('[role="alert"]')!
const open = (text = '音源暂不可用') => { setMessage(text); flush() }
const tick = (time: number) => { vi.advanceTimersByTime(time); flush() }

beforeEach(() => {
  vi.useFakeTimers()
  action.mockReset()
  dismiss.mockClear()
  setMessage(null)
  setMount(undefined)
  flush()
  const matches = HTMLElement.prototype.matches
  vi.spyOn(HTMLElement.prototype, 'matches').mockImplementation(function (this: HTMLElement, selector) {
    return selector === ':popover-open' ? this.hasAttribute('data-test-open') : matches.call(this, selector)
  })
  Object.defineProperty(HTMLElement.prototype, 'showPopover', { configurable: true, value() { this.setAttribute('data-test-open', ''); this.style.display = 'block' } })
  Object.defineProperty(HTMLElement.prototype, 'hidePopover', { configurable: true, value() { this.removeAttribute('data-test-open'); this.style.display = 'none' } })
  container = document.createElement('div')
  dialog = document.createElement('dialog')
  dialog.open = true
  trigger = document.createElement('button')
  document.body.append(container, dialog, trigger)
  dispose = render(() => createComponent(AlertPopover, {
    title: '播放失败',
    get message() { return message() },
    get portalMount() { return mount() },
    variant: 'destructive',
    onDismiss: dismiss,
    action: { label: '重试', onClick: action },
  }), container)
  flush()
})

afterEach(() => {
  dispose?.()
  container.remove()
  dialog.remove()
  trigger.remove()
  vi.restoreAllMocks()
  Reflect.deleteProperty(HTMLElement.prototype, 'showPopover')
  Reflect.deleteProperty(HTMLElement.prototype, 'hidePopover')
  vi.useRealTimers()
})

describe('顶部 Alert Popover', () => {
  it('出现错误时打开，保留原焦点，6 秒后自动关闭', () => {
    trigger.focus()
    expect(alert().matches(':popover-open')).toBe(false)
    open()
    expect(alert().matches(':popover-open')).toBe(true)
    expect(alert().textContent).toContain('播放失败音源暂不可用')
    expect(document.activeElement).toBe(trigger)
    tick(5999)
    expect(dismiss).not.toHaveBeenCalled()
    tick(1)
    expect(dismiss).toHaveBeenCalledOnce()
    expect(alert().matches(':popover-open')).toBe(false)
  })

  it('新错误重新计时，手动关闭后同样的错误仍能再次展示', () => {
    open('错误 A')
    tick(4000)
    open('错误 B')
    tick(3000)
    expect(dismiss).not.toHaveBeenCalled()
    alert().querySelector<HTMLButtonElement>('[aria-label="关闭提示"]')!.click()
    flush()
    expect(alert().matches(':popover-open')).toBe(false)
    expect(vi.getTimerCount()).toBe(0)
    open('错误 B')
    expect(alert().matches(':popover-open')).toBe(true)
    // jsdom 的 click 会保留 :hover，模拟用户把鼠标移出通知。
    alert().dispatchEvent(new Event('pointerleave'))
    tick(6000)
    expect(dismiss).toHaveBeenCalledTimes(2)
  })

  it('悬停或键盘操作时暂停自动关闭，离开后恢复计时', () => {
    open()
    alert().dispatchEvent(new Event('pointerenter'))
    tick(7000)
    expect(dismiss).not.toHaveBeenCalled()
    const retry = alert().querySelector('button')!
    retry.focus()
    alert().dispatchEvent(new Event('pointerleave'))
    tick(7000)
    expect(dismiss).not.toHaveBeenCalled()
    retry.click()
    expect(action).toHaveBeenCalledOnce()
    trigger.focus()
    tick(6000)
    expect(dismiss).toHaveBeenCalledOnce()
  })

  it('打开或收起模态播放器时只保留一条可操作通知，销毁后取消计时', () => {
    open()
    setMount(dialog)
    flush()
    expect(document.querySelectorAll('[role="alert"]')).toHaveLength(1)
    expect(dialog.contains(alert())).toBe(true)
    expect(alert().matches(':popover-open')).toBe(true)
    alert().querySelector('button')!.click()
    expect(action).toHaveBeenCalledOnce()
    setMount(undefined)
    flush()
    expect(dialog.contains(alert())).toBe(false)
    expect(alert().matches(':popover-open')).toBe(true)
    dispose?.()
    dispose = undefined
    expect(vi.getTimerCount()).toBe(0)
    tick(7000)
    expect(dismiss).not.toHaveBeenCalled()
  })
})
