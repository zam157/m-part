import { createComponent, render } from '@solidjs/web'
import { createSignal, flush } from 'solid-js'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import Dialog, { DialogBody, DialogFooter, DialogHeader } from '~/components/Dialog/Dialog'
import { mockDialog } from '../helpers/dialog'

let dispose: (() => void) | undefined
let restore: () => void
let container: HTMLDivElement
beforeEach(() => {
  restore = mockDialog()
  container = document.createElement('div'); document.body.append(container)
})
afterEach(() => { dispose?.(); dispose = undefined; container.remove(); vi.restoreAllMocks(); restore() })

function mount(initial = false, target: HTMLElement = container, closeOnOutsideClick?: boolean) {
  const [open, setOpen] = createSignal(initial)
  const [title, setTitle] = createSignal('设置')
  const onClose = vi.fn(() => setOpen(false))
  const input = document.createElement('input')
  const save = document.createElement('button'); save.type = 'submit'; save.textContent = '保存'
  dispose = render(() => createComponent(Dialog, {
    get open() { return open() }, onClose, closeOnOutsideClick,
    'aria-labelledby': 'dialog-test-title', 'aria-describedby': 'dialog-test-description',
    get children() { return [
      createComponent(DialogHeader, { get title() { return title() }, titleId: 'dialog-test-title', description: '修改本机设置', descriptionId: 'dialog-test-description', onClose }),
      createComponent(DialogBody, { children: input }),
      createComponent(DialogFooter, { children: save }),
    ] },
  }), target)
  flush()
  return { setOpen, setTitle, onClose, save, dialog: target.querySelector('dialog')! }
}

function pointer(target: HTMLElement, type: 'pointerdown' | 'pointerup' | 'pointercancel', x: number) {
  target.dispatchEvent(new PointerEvent(type, { bubbles: true, pointerId: 1, isPrimary: true, button: 0, clientX: x, clientY: 120 }))
  flush()
}

describe('Dialog', () => {
  it('syncs controlled changes without echoing a programmatic close to its owner', () => {
    const show = vi.spyOn(HTMLDialogElement.prototype, 'showModal')
    const close = vi.spyOn(HTMLDialogElement.prototype, 'close')
    const view = mount()
    expect(show).not.toHaveBeenCalled()
    view.setOpen(true); flush()
    expect(view.dialog.open).toBe(true)
    expect(show).toHaveBeenCalledOnce()
    view.setOpen(false); flush()
    expect(view.dialog.open).toBe(false)
    expect(close).toHaveBeenCalledOnce()
    expect(view.onClose).not.toHaveBeenCalled()
  })

  it('requests exactly one owner update for Escape and prevents the uncontrolled native dismissal', () => {
    const view = mount(true)
    const cancel = new Event('cancel', { cancelable: true })
    view.dialog.dispatchEvent(cancel); flush()
    expect(cancel.defaultPrevented).toBe(true)
    expect(view.onClose).toHaveBeenCalledOnce()
    expect(view.dialog.open).toBe(false)
  })

  it('requests one controlled close when a press begins and ends on the backdrop', () => {
    const { dialog, onClose } = mount(true)
    vi.spyOn(dialog, 'getBoundingClientRect').mockReturnValue(new DOMRect(100, 100, 200, 100))
    pointer(dialog, 'pointerdown', 110); pointer(dialog, 'pointerup', 110)
    pointer(dialog, 'pointerdown', 110); pointer(dialog, 'pointerup', 30)
    pointer(dialog, 'pointerdown', 30); pointer(dialog, 'pointerup', 110)
    pointer(dialog, 'pointerdown', 30); pointer(dialog, 'pointercancel', 30); pointer(dialog, 'pointerup', 30)
    expect(dialog.open).toBe(true)
    expect(onClose).not.toHaveBeenCalled()

    pointer(dialog, 'pointerdown', 30); pointer(dialog, 'pointerup', 30)
    expect(dialog.open).toBe(false)
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('keeps Escape enabled when outside click dismissal is disabled', () => {
    const { dialog, onClose } = mount(true, container, false)
    vi.spyOn(dialog, 'getBoundingClientRect').mockReturnValue(new DOMRect(100, 100, 200, 100))
    expect(dialog.getAttribute('closedby')).toBe('closerequest')
    pointer(dialog, 'pointerdown', 30); pointer(dialog, 'pointerup', 30)
    expect(dialog.open).toBe(true)
    expect(onClose).not.toHaveBeenCalled()

    dialog.dispatchEvent(new Event('cancel', { cancelable: true })); flush()
    expect(dialog.open).toBe(false)
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('syncs a native close and ignores a stale close event after reopening', () => {
    const view = mount(true)
    view.dialog.close(); flush()
    expect(view.onClose).toHaveBeenCalledOnce()
    view.onClose.mockClear()
    view.setOpen(true); flush()
    view.dialog.dispatchEvent(new Event('close')); flush()
    expect(view.dialog.open).toBe(true)
    expect(view.onClose).not.toHaveBeenCalled()
  })

  it('keeps accessible title and description associations reactive', () => {
    const view = mount(true)
    expect(view.dialog.querySelector(`#${view.dialog.getAttribute('aria-labelledby')}`)?.textContent).toBe('设置')
    expect(view.dialog.querySelector(`#${view.dialog.getAttribute('aria-describedby')}`)?.textContent).toBe('修改本机设置')
    view.setTitle('账号设置'); flush()
    expect(view.dialog.querySelector('h2')?.textContent).toBe('账号设置')
    expect(view.dialog.getAttribute('aria-modal')).toBe('true')
  })

  it('does not submit a form through the header close button while preserving footer submission', () => {
    const form = document.createElement('form'); container.append(form)
    const submit = vi.fn((event: Event) => event.preventDefault()); form.addEventListener('submit', submit)
    const view = mount(true, form)
    view.save.click()
    expect(submit).toHaveBeenCalledOnce()
    submit.mockClear()
    const close = view.dialog.querySelector<HTMLButtonElement>('[data-slot="dialog-close"]')!
    expect(close.type).toBe('button')
    close.click(); flush()
    expect(submit).not.toHaveBeenCalled()
    expect(view.onClose).toHaveBeenCalledOnce()
  })

  it('dismisses nested popovers and releases the modal on disposal without notifying an unmounted owner', () => {
    const view = mount(true)
    const popover = document.createElement('div'); popover.setAttribute('popover', 'manual')
    const hide = vi.fn(); popover.hidePopover = hide; view.dialog.append(popover)
    dispose!(); dispose = undefined
    expect(hide).toHaveBeenCalledOnce()
    expect(view.dialog.open).toBe(false)
    expect(view.onClose).not.toHaveBeenCalled()
  })
})
