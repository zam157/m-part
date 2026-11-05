import type { JSX } from '@solidjs/web'
import { createComponent, render } from '@solidjs/web'
import { createSignal, flush, For, onCleanup } from 'solid-js'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '~/components/Tabs'
import type { TabsProps, TabsValue, TabsVariant } from '~/components/Tabs'

interface Option { value: TabsValue, label: string, disabled?: boolean }
const initial: Option[] = [
  { value: 'alpha', label: 'Alpha' },
  { value: 'disabled', label: 'Disabled', disabled: true },
  { value: 'beta', label: 'Beta' },
  { value: 'gamma', label: 'Gamma' },
]
const disposers: (() => void)[] = []
async function settled() { flush(); await Promise.resolve(); flush(); await Promise.resolve(); flush() }
afterEach(() => { disposers.splice(0).forEach(dispose => dispose()); document.body.replaceChildren() })

async function mount(props: Partial<TabsProps<TabsValue>> = {}, config: {
  activateOnFocus?: boolean, loopFocus?: boolean, keepMounted?: boolean, variant?: TabsVariant, options?: Option[],
} = {}, target: HTMLElement = document.body) {
  const [options, setOptions] = createSignal(config.options ?? initial)
  const removed: TabsValue[] = []
  function Options(props: { each: Option[], children: (item: Option) => JSX.Element }) { return For(props) }
  function Panel(props: { value: TabsValue }) {
    const input = document.createElement('input')
    input.setAttribute('aria-label', 'Panel field')
    onCleanup(() => removed.push(props.value))
    return input
  }
  const rootProps: TabsProps<TabsValue> = {
    get children() { return [
      createComponent(TabsList, {
        'aria-label': 'Examples', variant: config.variant, activateOnFocus: config.activateOnFocus, loopFocus: config.loopFocus,
        get children() { return createComponent(Options, {
          get each() { return options() },
          children: (item: Option) => createComponent(TabsTrigger, { value: item.value, disabled: item.disabled, children: item.label }),
        }) },
      }),
      createComponent(Options, {
        get each() { return options() },
        children: (item: Option) => createComponent(TabsContent, {
          value: item.value, keepMounted: config.keepMounted,
          get children() { return createComponent(Panel, { value: item.value }) },
        }),
      }),
    ] },
  }
  Object.defineProperties(rootProps, Object.getOwnPropertyDescriptors(props))
  disposers.push(render(() => createComponent(Tabs<TabsValue>, rootProps), target))
  await settled()
  const root = target.querySelector<HTMLElement>('[data-slot="tabs"]')!
  const tabs = () => [...root.querySelectorAll<HTMLButtonElement>('[role="tab"]')]
  const tab = (label: string) => tabs().find(tab => tab.textContent === label)!
  const selected = () => tabs().find(tab => tab.getAttribute('aria-selected') === 'true')
  const panel = (label: string) => document.getElementById(tab(label).getAttribute('aria-controls')!)!
  function click(label: string) { tab(label).click(); flush() }
  function key(label: string, key: string, extra: KeyboardEventInit = {}) {
    tab(label).focus(); flush()
    const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...extra })
    tab(label).dispatchEvent(event); flush()
    return event
  }
  return { root, tabs, tab, selected, panel, click, key, setOptions, removed }
}

describe('compound Tabs', async () => {
  it('selects the first enabled tab and connects every trigger to a named panel', async () => {
    const view = await mount({}, { options: [{ ...initial[0]!, disabled: true }, ...initial.slice(1)] })
    expect(view.selected()).toBe(view.tab('Beta'))
    expect(view.tabs().filter(tab => tab.tabIndex === 0)).toEqual([view.tab('Beta')])
    for (const tab of view.tabs()) {
      const panel = document.getElementById(tab.getAttribute('aria-controls')!)!
      expect(panel.getAttribute('role')).toBe('tabpanel')
      expect(panel.getAttribute('aria-labelledby')).toBe(tab.id)
      expect(panel.hidden).toBe(tab !== view.selected())
    }
  })

  it('supports default values, explicit no-selection and reactive controlled values without changing the owner', async () => {
    const [value, setValue] = createSignal<TabsValue | null>('beta')
    const changed = vi.fn()
    const view = await mount({ get value() { return value() }, onValueChange: changed })
    view.click('Gamma')
    expect(changed).toHaveBeenCalledExactlyOnceWith('gamma')
    expect(view.selected()).toBe(view.tab('Beta'))
    setValue('gamma'); flush()
    expect(view.selected()).toBe(view.tab('Gamma'))
    view.click('Gamma')
    expect(changed).toHaveBeenCalledTimes(1)
    setValue(null); flush()
    expect(view.selected()).toBeUndefined()
    expect([...view.root.querySelectorAll<HTMLElement>('[role="tabpanel"]')].every(panel => panel.hidden)).toBe(true)
  })

  it('uses manual activation by default, skips disabled tabs, wraps focus and supports Home/End', async () => {
    const view = await mount({ defaultValue: 'alpha' })
    view.key('Alpha', 'ArrowRight')
    expect(document.activeElement).toBe(view.tab('Beta'))
    expect(view.selected()).toBe(view.tab('Alpha'))
    expect(view.tab('Beta').tabIndex).toBe(0)
    view.key('Beta', 'Enter')
    expect(view.selected()).toBe(view.tab('Beta'))
    view.key('Beta', 'End')
    expect(document.activeElement).toBe(view.tab('Gamma'))
    view.key('Gamma', 'ArrowRight')
    expect(document.activeElement).toBe(view.tab('Alpha'))
    view.key('Alpha', 'ArrowLeft')
    expect(document.activeElement).toBe(view.tab('Gamma'))
    view.key('Gamma', 'Home')
    expect(document.activeElement).toBe(view.tab('Alpha'))
  })

  it('supports focus activation and non-looping vertical keyboard navigation', async () => {
    const view = await mount({ defaultValue: 'alpha', orientation: 'vertical' }, { activateOnFocus: true, loopFocus: false, variant: 'line' })
    expect(view.root.querySelector('[role="tablist"]')?.getAttribute('aria-orientation')).toBe('vertical')
    expect(view.root.querySelector('[data-variant]')?.getAttribute('data-variant')).toBe('line')
    view.key('Alpha', 'ArrowDown')
    expect(document.activeElement).toBe(view.tab('Beta'))
    expect(view.selected()).toBe(view.tab('Beta'))
    view.key('Beta', 'End'); view.key('Gamma', 'ArrowDown')
    expect(document.activeElement).toBe(view.tab('Gamma'))
    const horizontal = view.key('Gamma', 'ArrowLeft')
    expect(horizontal.defaultPrevented).toBe(false)
  })

  it('does not activate disabled tabs or interfere with Tab/modifier shortcuts', async () => {
    const view = await mount({ defaultValue: 'alpha' })
    view.click('Disabled')
    expect(view.selected()).toBe(view.tab('Alpha'))
    expect(view.key('Alpha', 'Tab').defaultPrevented).toBe(false)
    expect(view.key('Alpha', 'ArrowRight', { ctrlKey: true }).defaultPrevented).toBe(false)
    expect(view.selected()).toBe(view.tab('Alpha'))
    view.key('Alpha', 'ArrowRight')
    view.panel('Alpha').querySelector('input')!.focus(); flush()
    expect(view.tab('Alpha').tabIndex).toBe(0)
  })

  it('unmounts inactive content by default and retains local form state with keepMounted', async () => {
    const view = await mount({ defaultValue: 'alpha' }, { keepMounted: true })
    const input = view.panel('Alpha').querySelector('input')!
    input.value = 'unsaved'
    view.click('Beta')
    expect(view.panel('Alpha').hidden).toBe(true)
    expect(view.panel('Alpha').hasAttribute('inert')).toBe(true)
    view.click('Alpha')
    expect(view.panel('Alpha').querySelector('input')).toBe(input)
    expect(input.value).toBe('unsaved')
    expect(view.removed).toEqual([])
  })

  it('lazily mounts panel bodies and disposes the previous body on switching', async () => {
    const view = await mount({ defaultValue: 'alpha' })
    expect(view.panel('Beta').querySelector('input')).toBeNull()
    view.click('Beta')
    expect(view.panel('Alpha').querySelector('input')).toBeNull()
    expect(view.panel('Beta').querySelector('input')).not.toBeNull()
    expect(view.removed).toContain('alpha')
  })

  it('falls back when an uncontrolled active tab is disabled or removed, and recovers from an empty list', async () => {
    const changed = vi.fn()
    const view = await mount({ defaultValue: 'beta', onValueChange: changed })
    view.setOptions(initial.map(item => item.value === 'beta' ? { ...item, disabled: true } : item)); await settled()
    expect(view.selected()).toBe(view.tab('Gamma'))
    view.setOptions(initial.filter(item => item.value !== 'gamma')); await settled()
    expect(view.selected()).toBe(view.tab('Alpha'))
    view.setOptions([]); await settled()
    expect(changed).toHaveBeenLastCalledWith(null)
    view.setOptions(initial); await settled()
    expect(view.selected()).toBe(view.tab('Alpha'))
  })

  it('keeps controlled selection unchanged when its tab becomes disabled', async () => {
    const changed = vi.fn()
    const view = await mount({ value: 'beta', onValueChange: changed })
    view.setOptions(initial.map(item => ({ ...item, disabled: true }))); await settled()
    expect(changed).not.toHaveBeenCalled()
    expect(view.tabs().every(tab => tab.tabIndex === -1)).toBe(true)
  })

  it('preserves selection when a list replaces every item with the same values in one update', async () => {
    const changed = vi.fn()
    const view = await mount({ defaultValue: 'beta', onValueChange: changed })
    view.setOptions(initial.map(item => ({ ...item }))); await settled()
    expect(view.selected()).toBe(view.tab('Beta'))
    expect(changed).not.toHaveBeenCalled()
  })

  it('supports an explicit uncontrolled empty value without silently selecting the first tab', async () => {
    const view = await mount({ defaultValue: null })
    expect(view.selected()).toBeUndefined()
    view.click('Beta')
    expect(view.selected()).toBe(view.tab('Beta'))
  })

  it('uses current DOM order after existing tabs move', async () => {
    const view = await mount({ defaultValue: 'alpha' })
    view.setOptions([...initial].reverse()); await settled()
    view.key('Alpha', 'Home')
    expect(document.activeElement).toBe(view.tab('Gamma'))
    view.key('Gamma', 'End')
    expect(document.activeElement).toBe(view.tab('Alpha'))
  })

  it('keeps nested root state independent', async () => {
    const outer = await mount({ defaultValue: 'alpha' })
    const nested = document.createElement('div'); outer.panel('Alpha').append(nested)
    const inner = await mount({ defaultValue: 'alpha' }, {}, nested)
    inner.click('Beta')
    expect(inner.selected()).toBe(inner.tab('Beta'))
    expect(outer.selected()).toBe(outer.tab('Alpha'))
  })

  it('generates distinct IDs for multiple roots and for numeric versus string values', async () => {
    const first = document.createElement('div'), second = document.createElement('div'); document.body.append(first, second)
    const options = [{ value: 1, label: 'Number' }, { value: '1', label: 'String' }]
    const a = await mount({ defaultValue: 1 }, { options }, first)
    const b = await mount({ defaultValue: '1' }, { options }, second)
    expect(new Set([...a.tabs(), ...b.tabs()].map(tab => tab.id)).size).toBe(4)
    expect(a.selected()).toBe(a.tab('Number'))
    expect(b.selected()).toBe(b.tab('String'))
  })

  it('never submits a parent form when activating by click, Enter or Space', async () => {
    const form = document.createElement('form'); document.body.append(form)
    const submit = vi.fn((event: Event) => event.preventDefault()); form.addEventListener('submit', submit)
    const view = await mount({ defaultValue: 'alpha' }, {}, form)
    view.click('Beta'); view.key('Gamma', ' '); view.key('Alpha', 'Enter')
    expect(submit).not.toHaveBeenCalled()
    expect(view.selected()).toBe(view.tab('Alpha'))
  })
})
