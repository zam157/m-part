import type { JSX } from '@solidjs/web'
import { clsx } from 'cn/lite'
import { createContext, createEffect, createSignal, createUniqueId, onCleanup, Show, untrack, useContext } from 'solid-js'

export type TabsValue = string | number
export type TabsOrientation = 'horizontal' | 'vertical'
export type TabsVariant = 'default' | 'line'

export interface TabsProps<T extends TabsValue = string> {
  value?: T | null
  defaultValue?: T | null
  onValueChange?: (value: T | null) => void
  orientation?: TabsOrientation
  id?: string
  class?: string
  children?: JSX.Element
}

export interface TabsListProps {
  variant?: TabsVariant
  activateOnFocus?: boolean
  loopFocus?: boolean
  'aria-label'?: string
  'aria-labelledby'?: string
  class?: string
  children?: JSX.Element
}

export interface TabsTriggerProps {
  value: TabsValue
  disabled?: boolean
  'aria-label'?: string
  class?: string
  children?: JSX.Element
}

export interface TabsContentProps {
  value: TabsValue
  keepMounted?: boolean
  class?: string
  children?: JSX.Element
}

interface RegisteredTab {
  element: HTMLButtonElement
  value: TabsValue
  disabled: boolean
}

interface RootContextValue {
  value: () => TabsValue | null
  orientation: () => TabsOrientation
  triggerId: (value: TabsValue) => string
  panelId: (value: TabsValue) => string
  register: (tab: RegisteredTab) => () => void
  ordered: () => RegisteredTab[]
  focus: (value: TabsValue | null) => void
  tabStop: () => TabsValue | null
  select: (value: TabsValue) => void
}

interface ListContextValue {
  variant: () => TabsVariant
  activateOnFocus: () => boolean
}

const RootContext = createContext<RootContextValue>()
const ListContext = createContext<ListContextValue>()
function useRoot() {
  const context = useContext(RootContext)
  if (!context) throw new Error('Tabs components must be used inside Tabs')
  return context
}

/** New compound API; the existing Tabs.tsx data API is retained until its callers migrate. */
export function Tabs<T extends TabsValue = string>(props: TabsProps<T>) {
  const generatedId = createUniqueId()
  const [localValue, setLocalValue] = createSignal<TabsValue | null | undefined>(untrack(() => props.defaultValue))
  const [items, setItems] = createSignal<RegisteredTab[]>([])
  const [focused, setFocused] = createSignal<TabsValue | null>(null)
  let registered = false
  let recoverEmpty = false
  let disposed = false
  const value = () => props.value !== undefined ? props.value : localValue() ?? null
  const orientation = () => props.orientation ?? 'horizontal'
  const key = (value: TabsValue) => `${typeof value === 'number' ? 'n' : 's'}-${encodeURIComponent(String(value))}`
  const id = (part: string, value: TabsValue) => `${props.id ?? generatedId}-${part}-${key(value)}`
  const ordered = () => items().slice().sort((a, b) => a.element === b.element ? 0 : a.element.compareDocumentPosition(b.element) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1)

  createEffect(() => ({ entries: ordered(), current: localValue(), controlled: props.value !== undefined, registered, onChange: props.onValueChange }), ({ entries, current, controlled, registered, onChange }) => {
    // A keyed list may remove and re-register the same value in one update.
    // Reconcile after registration settles, rather than selecting an intermediate fallback.
    let cancelled = false
    queueMicrotask(() => {
      if (cancelled || disposed || controlled || !registered || current === null && !recoverEmpty) return
      const index = entries.findIndex(tab => tab.value === current)
      if (index >= 0 && !entries[index]!.disabled) return
      const next = [...entries.slice(index + 1), ...entries.slice(0, index + 1)].find(tab => !tab.disabled)?.value ?? null
      recoverEmpty = next === null
      if (next === current) return
      setLocalValue(next)
      onChange?.(next as T | null)
    })
    return () => { cancelled = true }
  })
  onCleanup(() => { disposed = true })

  const context: RootContextValue = {
    value, orientation, ordered,
    triggerId: value => id('trigger', value),
    panelId: value => id('panel', value),
    register(tab) {
      registered = true
      setItems(previous => [...previous, tab])
      return () => { if (!disposed) setItems(previous => previous.filter(item => item !== tab)) }
    },
    focus: value => setFocused(value),
    tabStop() {
      const enabled = ordered().filter(tab => !tab.disabled)
      return enabled.find(tab => tab.value === focused())?.value
        ?? enabled.find(tab => tab.value === value())?.value ?? enabled[0]?.value ?? null
    },
    select(next) {
      if (next === value() || !ordered().some(tab => tab.value === next && !tab.disabled)) return
      if (props.value === undefined) { recoverEmpty = false; setLocalValue(next) }
      props.onValueChange?.(next as T)
    },
  }
  return (
    <RootContext value={context}>
      <div id={props.id} data-slot="tabs" data-orientation={orientation()}
        class={clsx('uno-layer-components:(flex min-w-0 gap-2)', orientation() === 'vertical' ? 'uno-layer-components:flex-row' : 'uno-layer-components:flex-col', props.class)}>
        {props.children}
      </div>
    </RootContext>
  )
}

export function TabsList(props: TabsListProps) {
  const root = useRoot()
  const variant = () => props.variant ?? 'default'
  function keyDown(event: KeyboardEvent) {
    if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey || !(event.target instanceof Element)
      || event.target.closest('[role="tablist"]') !== event.currentTarget) return
    const forward = root.orientation() === 'horizontal' ? 'ArrowRight' : 'ArrowDown'
    const backward = root.orientation() === 'horizontal' ? 'ArrowLeft' : 'ArrowUp'
    if (![forward, backward, 'Home', 'End'].includes(event.key)) return
    const enabled = root.ordered().filter(tab => !tab.disabled)
    if (!enabled.length) return
    const element = event.target.closest('[role="tab"]')
    const current = enabled.findIndex(tab => tab.element === element)
    let index = event.key === 'Home' ? 0 : event.key === 'End' ? enabled.length - 1 : current + (event.key === forward ? 1 : -1)
    index = props.loopFocus === false ? Math.max(0, Math.min(enabled.length - 1, index)) : (index + enabled.length) % enabled.length
    event.preventDefault()
    root.focus(enabled[index]!.value)
    enabled[index]!.element.focus()
  }
  return (
    <ListContext value={{ variant, activateOnFocus: () => props.activateOnFocus ?? false }}>
      <div role="tablist" data-slot="tabs-list" data-variant={variant()} data-orientation={root.orientation()}
        aria-label={props['aria-label']} aria-labelledby={props['aria-labelledby']} aria-orientation={root.orientation()}
        class={clsx('uno-layer-components:(inline-flex w-fit shrink-0 items-center text-muted-foreground)',
          root.orientation() === 'vertical' ? 'uno-layer-components:(h-auto flex-col)' : 'uno-layer-components:h-8',
          variant() === 'line' ? 'uno-layer-components:(gap-4 bg-transparent p-0)' : 'uno-layer-components:(gap-1 rounded-lg bg-muted p-[3px])', props.class)}
        onKeyDown={keyDown}
        onFocusOut={event => { if (!(event.relatedTarget instanceof Node) || !event.currentTarget.contains(event.relatedTarget)) root.focus(null) }}>
        {props.children}
      </div>
    </ListContext>
  )
}

export function TabsTrigger(props: TabsTriggerProps) {
  const root = useRoot()
  const list = useContext(ListContext)
  if (!list) throw new Error('TabsTrigger must be used inside TabsList')
  let element!: HTMLButtonElement
  const active = () => root.value() === props.value
  createEffect(() => ({ value: props.value, disabled: !!props.disabled }), state => root.register({ element, ...state }))
  function activate() { if (!props.disabled) root.select(props.value) }
  return (
    <button ref={element} type="button" role="tab" id={root.triggerId(props.value)} data-slot="tabs-trigger"
      data-state={active() ? 'active' : 'inactive'} data-active={active() ? '' : undefined} data-orientation={root.orientation()}
      aria-selected={active() ? 'true' : 'false'} aria-controls={root.panelId(props.value)} aria-label={props['aria-label']}
      disabled={props.disabled} tabindex={!props.disabled && root.tabStop() === props.value ? 0 : -1}
      class={clsx('uno-layer-components:(inline-flex min-w-0 shrink-0 items-center justify-center gap-1.5 border border-transparent text-sm font-medium whitespace-nowrap outline-none transition-colors disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1)',
        root.orientation() === 'vertical' || list.variant() === 'line' ? 'uno-layer-components:h-8' : 'uno-layer-components:h-full',
        list.variant() === 'line'
          ? clsx("uno-layer-components:(relative rounded-none px-1 after:absolute after:bg-foreground after:content-[''] after:transition-opacity)",
            root.orientation() === 'vertical' ? 'uno-layer-components:(after:left-0 after:inset-y-0 after:w-0.5)' : 'uno-layer-components:(after:bottom-0 after:inset-x-0 after:h-0.5)',
            active() ? 'uno-layer-components:(text-foreground after:opacity-100)' : 'uno-layer-components:(after:opacity-0 hover:text-foreground)')
          : clsx('uno-layer-components:(rounded-md px-2.5)', active() ? 'uno-layer-components:(bg-background text-foreground shadow-sm)' : 'uno-layer-components:hover:text-foreground'), props.class)}
      onFocus={() => { root.focus(props.value); if (list.activateOnFocus()) activate() }}
      onClick={activate}
      onKeyDown={event => { if (!event.defaultPrevented && (event.key === 'Enter' || event.key === ' ')) { event.preventDefault(); activate() } }}>
      {props.children}
    </button>
  )
}

export function TabsContent(props: TabsContentProps) {
  const root = useRoot()
  const active = () => root.value() === props.value
  return (
    <div role="tabpanel" id={root.panelId(props.value)} data-slot="tabs-content" data-state={active() ? 'active' : 'inactive'}
      data-active={active() ? '' : undefined} data-orientation={root.orientation()}
      aria-labelledby={root.triggerId(props.value)} hidden={!active()} inert={!active()} tabindex={active() ? 0 : -1}
      class={clsx('uno-layer-components:(min-w-0 outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2)', !active() && '!hidden', props.class)}>
      <Show when={active() || props.keepMounted}>{props.children}</Show>
    </div>
  )
}
