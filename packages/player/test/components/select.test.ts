import { createComponent, render } from '@solidjs/web'
import { createSignal, flush } from 'solid-js'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import Select, { type SelectProps } from '~/components/Select/Select'
import { mockPopover } from '../helpers/popover'

const options = [
  { value: 'apple', label: 'Apple' },
  { value: 'apricot', label: 'Apricot', disabled: true },
  { value: 'banana', label: 'Banana' },
  { value: 'blueberry', label: 'Blueberry' },
  { value: 'cherry', label: 'Cherry' },
]
let dispose: (() => void) | undefined
let restore: () => void
beforeEach(() => { restore = mockPopover() })
afterEach(() => { dispose?.(); dispose = undefined; restore(); document.body.replaceChildren() })
function mount(props: Partial<SelectProps<string>> = {}, container: HTMLElement = document.body) {
  const combined: SelectProps<string> = { options, placeholder: '选择水果' }
  Object.defineProperties(combined, Object.getOwnPropertyDescriptors(props))
  dispose = render(() => createComponent(Select<string>, combined), container)
  flush()
}
const trigger = () => document.querySelector<HTMLButtonElement>('[role="combobox"]')!
const popup = () => document.querySelector<HTMLElement>('[data-slot="select-content"]')!
const row = (label: string) => [...document.querySelectorAll<HTMLElement>('[role="option"]')].find(item => item.textContent === label)!
const active = () => document.getElementById(trigger().getAttribute('aria-activedescendant') ?? '')
function key(value: string, modifiers: KeyboardEventInit = {}) { trigger().focus(); trigger().dispatchEvent(new KeyboardEvent('keydown', { key: value, bubbles: true, cancelable: true, ...modifiers })); flush() }
function open() { trigger().focus(); trigger().click(); flush() }

describe('shared select', () => {
  it('provides placeholder, labels, selection indicator and an uncontrolled default', () => {
    mount({ defaultValue: 'banana', 'aria-label': '水果' })
    expect(trigger().textContent).toContain('Banana')
    expect(trigger().getAttribute('aria-expanded')).toBe('false')
    expect(trigger().getAttribute('aria-label')).toBe('水果')
    open()
    expect(popup().matches(':popover-open')).toBe(true)
    expect(active()).toBe(row('Banana'))
    expect(row('Banana').getAttribute('aria-selected')).toBe('true')
    row('Cherry').click(); flush()
    expect(trigger().textContent).toContain('Cherry')
    expect(trigger().getAttribute('aria-expanded')).toBe('false')
    expect(document.activeElement).toBe(trigger())
  })
  it('keeps a controlled value until its owner accepts the change', () => {
    const [value, setValue] = createSignal('apple')
    const changed = vi.fn()
    mount({ get value() { return value() }, onValueChange: changed })
    open(); row('Banana').click(); flush()
    expect(changed).toHaveBeenCalledExactlyOnceWith('banana')
    expect(trigger().textContent).toContain('Apple')
    setValue('banana'); flush()
    expect(trigger().textContent).toContain('Banana')
    open(); row('Banana').click(); flush()
    expect(changed).toHaveBeenCalledTimes(1)
  })
  it('navigates disabled items, Home/End and Page keys without changing the value until confirmation', () => {
    const changed = vi.fn()
    mount({ defaultValue: 'apple', onValueChange: changed })
    key('ArrowDown'); key('ArrowDown')
    expect(active()).toBe(row('Banana'))
    expect(trigger().textContent).toContain('Apple')
    expect(document.activeElement).toBe(trigger())
    key('End'); expect(active()).toBe(row('Cherry'))
    key('PageUp'); expect(active()).toBe(row('Apple'))
    key('PageDown'); expect(active()).toBe(row('Cherry'))
    key('Home'); key('ArrowDown'); key('Enter')
    expect(changed).toHaveBeenCalledExactlyOnceWith('banana')
    expect(trigger().textContent).toContain('Banana')
  })
  it('supports typeahead and repeated-character cycling; Escape discards navigation', () => {
    mount({ defaultValue: 'apple' })
    key('b'); expect(active()).toBe(row('Banana'))
    key('b'); expect(active()).toBe(row('Blueberry'))
    key('Escape')
    expect(trigger().textContent).toContain('Apple')
    expect(trigger().getAttribute('aria-expanded')).toBe('false')
    key('c'); key('Enter')
    expect(trigger().textContent).toContain('Cherry')
  })
  it('does not submit its parent form with Enter/Space and lets Tab keep normal navigation', () => {
    const form = document.createElement('form'); document.body.append(form)
    const submit = vi.fn(event => event.preventDefault()); form.addEventListener('submit', submit)
    mount({}, form)
    key(' '); key('End')
    const tab = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true })
    trigger().dispatchEvent(tab); flush()
    expect(tab.defaultPrevented).toBe(false)
    expect(trigger().textContent).toContain('Cherry')
    expect(submit).not.toHaveBeenCalled()
  })
  it('ignores disabled options and closes when the whole control becomes disabled', () => {
    const [disabled, setDisabled] = createSignal(false)
    const changed = vi.fn()
    mount({ get disabled() { return disabled() }, onValueChange: changed })
    open(); row('Apricot').click(); flush()
    expect(changed).not.toHaveBeenCalled()
    expect(trigger().getAttribute('aria-expanded')).toBe('true')
    setDisabled(true); flush()
    expect(trigger().disabled).toBe(true)
    expect(trigger().getAttribute('aria-expanded')).toBe('false')
  })
  it('keeps ARIA state synchronized with native outside/Escape dismissal', () => {
    const changed = vi.fn()
    mount({ onOpenChange: changed })
    open(); popup().hidePopover(); flush()
    expect(trigger().getAttribute('aria-expanded')).toBe('false')
    expect(trigger().getAttribute('aria-activedescendant')).toBeNull()
    expect(changed.mock.calls).toEqual([[true], [false]])
    open(); expect(trigger().getAttribute('aria-expanded')).toBe('true')
  })
  it('renders grouped options with labels, separators and RTL metadata', () => {
    mount({ dir: 'rtl', options: [{ label: '水果', options: options.slice(0, 2) }, { label: '其他', options: options.slice(2) }] })
    expect(popup().querySelectorAll('[role="group"]')).toHaveLength(2)
    expect(popup().querySelectorAll('[role="separator"]')).toHaveLength(1)
    expect(popup().dir).toBe('rtl')
    key('End'); key('Enter')
    expect(trigger().textContent).toContain('Cherry')
  })
  it('repairs an active option when the options change dynamically', () => {
    const [items, setItems] = createSignal(options)
    mount({ get options() { return items() } })
    key('End'); expect(active()).toBe(row('Cherry'))
    setItems(options.slice(0, 3)); flush()
    expect(active()).toBe(row('Apple'))
    key('End'); key('Enter')
    expect(trigger().textContent).toContain('Banana')
  })
  it('shares mapped option instances between rendering, selected indicators and active IDs', () => {
    mount({ get options() { return options.map(option => ({ ...option })) }, value: 'banana' })
    open()
    expect(row('Banana').getAttribute('aria-selected')).toBe('true')
    expect(active()).toBe(row('Banana'))
    expect(new Set([...popup().querySelectorAll('[role="option"]')].map(item => item.id)).size).toBe(options.length)
  })
  it('closes an empty list on Tab without blocking keyboard navigation', () => {
    mount({ options: [] })
    open(); key('Tab')
    expect(trigger().getAttribute('aria-expanded')).toBe('false')
  })
  it('serializes native form data, excludes disabled controls and restores defaults on reset', async () => {
    const form = document.createElement('form'); document.body.append(form)
    mount({ name: 'fruit', defaultValue: 'banana' }, form)
    expect(new FormData(form).get('fruit')).toBe('banana')
    open(); row('Cherry').click(); flush()
    expect(new FormData(form).get('fruit')).toBe('cherry')
    form.reset(); await Promise.resolve(); flush()
    expect(trigger().textContent).toContain('Banana')
    expect(new FormData(form).get('fruit')).toBe('banana')
    dispose?.(); dispose = undefined; form.replaceChildren()
    mount({ name: 'fruit', defaultValue: 'banana', disabled: true }, form)
    expect(new FormData(form).has('fruit')).toBe(false)
  })
  it('maps required validation to the accessible trigger and clears it after selection', () => {
    const form = document.createElement('form'); document.body.append(form)
    mount({ name: 'fruit', required: true }, form)
    expect(form.checkValidity()).toBe(false)
    flush()
    expect(trigger().getAttribute('aria-invalid')).toBe('true')
    expect(document.activeElement).toBe(trigger())
    open(); row('Banana').click(); flush()
    expect(form.checkValidity()).toBe(true)
    expect(trigger().getAttribute('aria-invalid')).toBe('false')
  })
  it('supports object identity, custom value rendering and explicit form serialization', () => {
    const first = { id: 1 }, second = { id: 2 }
    const form = document.createElement('form'); form.id = 'external-form'; document.body.append(form)
    dispose = render(() => createComponent(Select<{ id: number }>, {
      options: [{ label: 'First', value: first }, { label: 'Second', value: second }],
      value: { id: 2 }, isValueEqual: (a, b) => a.id === b.id,
      form: form.id, name: 'object', serializeValue: value => String(value.id),
      renderValue: option => `Selected ${option?.label}`,
    }), document.body); flush()
    expect(trigger().textContent).toBe('Selected Second')
    expect(new FormData(form).get('object')).toBe('2')
  })
  it('mounts the popup inside the enclosing native dialog', () => {
    const dialog = document.createElement('dialog'); dialog.open = true; document.body.append(dialog)
    mount({}, dialog)
    expect(dialog.contains(popup())).toBe(true)
    open(); row('Banana').click(); flush()
    expect(trigger().textContent).toContain('Banana')
  })
})
