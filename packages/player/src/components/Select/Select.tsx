import type { JSX } from '@solidjs/web'
import type { Option, SelectEntry } from './type'
import { Portal } from '@solidjs/web'
import { clsx } from 'cn/lite'
import { createEffect, createMemo, createSignal, createUniqueId, For, onCleanup, Show, untrack } from 'solid-js'
import './select.css'

export interface SelectProps<T> {
  options: readonly SelectEntry<T>[]
  value?: T
  defaultValue?: T
  onValueChange?: (value: T) => void
  onOpenChange?: (open: boolean) => void
  placeholder?: string
  disabled?: boolean
  required?: boolean
  invalid?: boolean
  id?: string
  name?: string
  form?: string
  dir?: 'ltr' | 'rtl'
  'aria-label'?: string
  'aria-labelledby'?: string
  'aria-describedby'?: string
  size?: 'sm' | 'default'
  triggerClass?: string
  contentClass?: string
  portalMount?: HTMLElement
  side?: 'top' | 'bottom'
  align?: 'start' | 'center' | 'end'
  sideOffset?: number
  alignItemWithTrigger?: boolean
  isValueEqual?: (a: T, b: T) => boolean
  serializeValue?: (value: T) => string
  renderValue?: (option: Option<T> | undefined) => JSX.Element
  renderOption?: (option: Option<T>) => JSX.Element
}

/** DOM focus stays on the trigger while the active option moves. */
export default function Select<T>(props: SelectProps<T>) {
  const generatedId = createUniqueId()
  const triggerId = () => props.id ?? `select-${generatedId}`
  const contentId = `select-content-${generatedId}`
  const initialValue = untrack(() => props.defaultValue)
  const [internalValue, setInternalValue] = createSignal<T | undefined>(() => initialValue)
  const [open, setOpen] = createSignal(false)
  const [active, setActive] = createSignal<Option<T>>()
  const [mount, setMount] = createSignal<HTMLElement>()
  const [canScrollUp, setCanScrollUp] = createSignal(false)
  const [canScrollDown, setCanScrollDown] = createSignal(false)
  const [validationFailed, setValidationFailed] = createSignal(false)
  let trigger!: HTMLButtonElement
  let popup!: HTMLDivElement
  let list!: HTMLDivElement
  let native: HTMLSelectElement | undefined
  let opened = false
  let pointerType = ''
  let search = '', searchedAt = 0
  let scrollTimer: ReturnType<typeof setInterval> | undefined
  const value = () => 'value' in props ? props.value : internalValue()
  const equal = (a: T, b: T) => props.isValueEqual?.(a, b) ?? Object.is(a, b)
  // A JSX getter may create a new array per read (for example mapped audio qualities).
  // Rendering, option IDs and selection must all use the same option instances.
  const entries = createMemo(() => props.options)
  const options = createMemo(() => entries().flatMap(entry => 'options' in entry ? [...entry.options] : [entry]))
  const enabled = () => options().filter(option => !option.disabled)
  const selected = createMemo(() => options().find(option => value() !== undefined && equal(option.value, value()!)))
  const optionId = (option: Option<T>) => `${contentId}-${options().indexOf(option)}`
  const serialize = (item: T) => props.serializeValue?.(item) ?? String(item)
  const formValue = () => selected() ? serialize(selected()!.value) : ''
  const invalid = () => props.invalid || validationFailed()

  function stopScrolling() { clearInterval(scrollTimer); scrollTimer = undefined }
  function updateScroll() {
    setCanScrollUp(list.scrollTop > 1)
    setCanScrollDown(list.scrollHeight - list.clientHeight - list.scrollTop > 1)
  }
  function reveal(option: Option<T> | undefined) {
    if (!option) return
    const element = document.getElementById(optionId(option))
    if (!element) return
    const item = element.getBoundingClientRect(), viewport = list.getBoundingClientRect()
    if (item.top < viewport.top) list.scrollTop -= viewport.top - item.top
    else if (item.bottom > viewport.bottom) list.scrollTop += item.bottom - viewport.bottom
    updateScroll()
  }
  function activate(option: Option<T> | undefined) { setActive(option); reveal(option) }

  function position() {
    if (!opened || !popup) return
    const margin = 8, width = window.innerWidth, height = window.innerHeight
    const rect = trigger.getBoundingClientRect()
    popup.style.minWidth = `${Math.min(Math.max(rect.width, 128), width - margin * 2)}px`
    popup.style.maxWidth = `${width - margin * 2}px`
    popup.style.maxHeight = `${height - margin * 2}px`
    const fullHeight = popup.getBoundingClientRect().height
    const offset = props.sideOffset ?? 4
    const above = Math.max(0, rect.top - offset - margin)
    const below = Math.max(0, height - rect.bottom - offset - margin)
    let side = props.side ?? 'bottom'
    if (fullHeight > (side === 'bottom' ? below : above) && (side === 'bottom' ? above > below : below > above)) side = side === 'bottom' ? 'top' : 'bottom'
    const item = selected() && document.getElementById(optionId(selected()!))
    const itemOffset = item ? item.getBoundingClientRect().top - popup.getBoundingClientRect().top : 0
    const alignedTop = item ? rect.top + (rect.height - item.getBoundingClientRect().height) / 2 - itemOffset : -1
    const alignSelected = props.alignItemWithTrigger !== false && pointerType !== 'touch' && !!item && rect.top >= 20 && rect.bottom <= height - 20 && alignedTop >= margin && alignedTop + fullHeight <= height - margin
    if (!alignSelected) popup.style.maxHeight = `${side === 'bottom' ? below : above}px`
    const bounds = popup.getBoundingClientRect()
    const rtl = (props.dir ?? getComputedStyle(trigger).direction) === 'rtl'
    const align = props.align ?? 'start'
    const left = align === 'center' ? rect.left + (rect.width - bounds.width) / 2 : (align === 'end') !== rtl ? rect.right - bounds.width : rect.left
    const top = alignSelected ? alignedTop : side === 'bottom' ? rect.bottom + offset : rect.top - offset - bounds.height
    popup.style.left = `${Math.max(margin, Math.min(left, width - bounds.width - margin))}px`
    popup.style.top = `${Math.max(margin, Math.min(top, height - bounds.height - margin))}px`
    popup.dataset.side = alignSelected ? 'none' : side
    updateScroll()
  }
  function close(restoreFocus = false, nativeClosing = false) {
    if (!opened) return
    opened = false; setOpen(false); setActive(undefined); stopScrolling()
    if (!nativeClosing && popup.matches(':popover-open')) popup.hidePopover()
    props.onOpenChange?.(false)
    search = ''
    if (restoreFocus) trigger.focus({ preventScroll: true })
  }
  function show(edge?: 'first' | 'last') {
    if (props.disabled || opened) return
    const items = enabled()
    opened = true; setOpen(true)
    const option = edge === 'first' ? items[0] : edge === 'last' ? items.at(-1) : selected()?.disabled ? items[0] : selected() ?? items[0]
    setActive(option)
    popup.showPopover({ source: trigger })
    position(); reveal(option)
    props.onOpenChange?.(true)
    // Overflow arrows can mount after the initial measurement.
    queueMicrotask(() => { if (opened) { position(); reveal(option) } })
  }
  function choose(option: Option<T> | undefined, restoreFocus = true) {
    if (!option || option.disabled || props.disabled) return
    const previous = value()
    if (!('value' in props)) setInternalValue(() => option.value)
    setValidationFailed(false)
    close(restoreFocus)
    if (previous === undefined || !equal(option.value, previous)) props.onValueChange?.(option.value)
  }
  function typeahead(key: string) {
    const now = Date.now()
    search = now - searchedAt > 700 ? key : search + key
    searchedAt = now
    const query = [...search].every(char => char === search[0]) ? search[0]! : search
    const items = enabled(), start = items.indexOf(active()!)
    const candidates = [...items.slice(start + (query.length === 1 ? 1 : 0)), ...items.slice(0, start + 1)]
    activate(candidates.find(option => option.label.toLocaleLowerCase().startsWith(query.toLocaleLowerCase())) ?? active())
  }
  function keyDown(event: KeyboardEvent) {
    if (props.disabled || event.isComposing) return
    const key = event.key
    if (key === 'Tab') { if (opened) { choose(active(), false); close() } return }
    if (key === 'Escape') { if (opened) { event.preventDefault(); event.stopPropagation(); close(true) } return }
    if (['ArrowDown', 'ArrowUp', 'Home', 'End', 'PageDown', 'PageUp', 'Enter', ' '].includes(key)) {
      event.preventDefault(); event.stopPropagation()
      if (key === 'ArrowDown' && event.altKey) { show(); return }
      if (!opened) { pointerType = ''; show(key === 'Home' ? 'first' : key === 'End' ? 'last' : undefined); return }
      if (key === 'Enter' || key === ' ' || (key === 'ArrowUp' && event.altKey)) { choose(active()); return }
      const items = enabled(), current = items.indexOf(active()!)
      const next = key === 'Home' ? 0 : key === 'End' ? items.length - 1 : current + (key === 'ArrowUp' ? -1 : key === 'PageUp' ? -10 : key === 'PageDown' ? 10 : 1)
      activate(items[Math.max(0, Math.min(next, items.length - 1))])
    }
    else if (key.length === 1 && !event.altKey && !event.ctrlKey && !event.metaKey) {
      event.preventDefault(); event.stopPropagation()
      if (!opened) { pointerType = ''; show() }
      typeahead(key)
    }
  }
  function scroll(direction: number) { list.scrollTop += direction * 48; updateScroll() }
  function startScrolling(direction: number) { stopScrolling(); scroll(direction); scrollTimer = setInterval(() => scroll(direction), 80) }

  createEffect(() => props.portalMount, target => { setMount(target ?? trigger.closest('dialog') ?? undefined) })
  createEffect(() => ({ open: open(), disabled: props.disabled, options: options(), value: value(), side: props.side, align: props.align, offset: props.sideOffset, alignItem: props.alignItemWithTrigger, dir: props.dir }), state => {
    if (!state.open) return
    if (state.disabled) { close(); return }
    const current = untrack(active)
    if (!current || !state.options.includes(current) || current.disabled) untrack(() => activate(selected()?.disabled ? enabled()[0] : selected() ?? enabled()[0]))
    // Inputs above drive reruns; measure their current committed DOM once per effect.
    untrack(position)
    const resize = () => position()
    const onScroll = (event: Event) => { if (!(event.target instanceof Node) || !popup.contains(event.target)) position() }
    const observer = typeof ResizeObserver === 'undefined' ? undefined : new ResizeObserver(resize)
    observer?.observe(trigger); observer?.observe(popup)
    window.addEventListener('resize', resize)
    document.addEventListener('scroll', onScroll, true)
    return () => { observer?.disconnect(); window.removeEventListener('resize', resize); document.removeEventListener('scroll', onScroll, true) }
  })
  createEffect(() => props.form, formId => {
    const form = formId ? document.getElementById(formId) : trigger.closest('form')
    const reset = () => queueMicrotask(() => {
      if (!('value' in props)) setInternalValue(() => initialValue)
      else if (props.defaultValue !== undefined) props.onValueChange?.(props.defaultValue)
      setValidationFailed(false); close()
      if (native) native.value = formValue()
    })
    form?.addEventListener('reset', reset)
    return () => form?.removeEventListener('reset', reset)
  })
  onCleanup(() => { stopScrolling(); if (popup?.matches(':popover-open')) popup.hidePopover() })

  function OptionRow(row: { option: Option<T> }) {
    return (
      <div id={optionId(row.option)} role="option" aria-selected={selected() === row.option ? 'true' : 'false'} aria-disabled={row.option.disabled ? 'true' : 'false'}
        data-highlighted={active() === row.option ? '' : undefined} data-state={selected() === row.option ? 'checked' : 'unchecked'}
        class={clsx('relative flex min-h-8 w-full cursor-default select-none items-center gap-2 rounded-sm py-1.5 ps-2 pe-8 text-sm outline-none data-[highlighted]:bg-accent data-[highlighted]:text-accent-foreground', row.option.disabled && 'pointer-events-none opacity-50')}
        onMouseDown={event => event.preventDefault()} onPointerMove={event => { if (event.pointerType !== 'touch' && !row.option.disabled) setActive(row.option) }} onClick={() => choose(row.option)}>
        <span class="min-w-0 flex-1">{props.renderOption ? props.renderOption(row.option) : row.option.label}</span>
        <Show when={selected() === row.option}><span class="i-lucide:check pointer-events-none absolute end-2 text-4" /></Show>
      </div>
    )
  }
  return (
    <>
      <button ref={trigger} id={triggerId()} type="button" role="combobox" disabled={props.disabled} dir={props.dir}
        aria-label={props['aria-label'] ?? (props['aria-labelledby'] ? undefined : props.placeholder ?? '选择选项')} aria-labelledby={props['aria-labelledby']} aria-describedby={props['aria-describedby']}
        aria-haspopup="listbox" aria-controls={contentId} aria-expanded={open() ? 'true' : 'false'} aria-activedescendant={open() && active() ? optionId(active()!) : undefined}
        aria-required={props.required ? 'true' : 'false'} aria-invalid={invalid() ? 'true' : 'false'} data-state={open() ? 'open' : 'closed'} data-placeholder={!selected() ? '' : undefined} data-size={props.size ?? 'default'}
        class={clsx('inline-flex min-w-0 shrink-0 cursor-default items-center justify-between gap-2 rounded-lg border border-input bg-transparent px-3 text-sm shadow-xs outline-none transition-[color,box-shadow] focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50 dark:bg-input/30', props.size === 'sm' ? 'h-8' : 'h-9', !selected() && 'text-muted-foreground', invalid() && 'border-destructive ring-destructive/20', props.triggerClass)}
        onPointerDown={event => { pointerType = event.pointerType }} onKeyDown={keyDown} onClick={() => opened ? close(true) : show()}>
        <span class="min-w-0 truncate">{props.renderValue ? props.renderValue(selected()) : selected()?.label ?? props.placeholder ?? '请选择'}</span>
        <Show when={!props.renderValue}><span class="i-lucide:chevron-down shrink-0 text-4 text-muted-foreground" /></Show>
      </button>
      <Show when={props.name || props.required}>
        <select ref={element => { native = element }} hidden tabindex={-1} aria-hidden="true" name={props.name} form={props.form} required={props.required} disabled={props.disabled} value={formValue()}
          onInvalid={event => { event.preventDefault(); setValidationFailed(true); trigger.focus() }}
          onChange={event => { choose(options().find(option => serialize(option.value) === event.currentTarget.value), false); event.currentTarget.value = formValue() }}>
          <option value="" />
          <For each={options()}>{option => <option value={serialize(option.value)} disabled={option.disabled}>{option.label}</option>}</For>
        </select>
      </Show>
      <Portal mount={mount()}>
        <div ref={popup} id={`${contentId}-popup`} popover="auto" dir={props.dir} data-slot="select-content"
          class={clsx('select-content open:flex flex-col overflow-hidden rounded-md border border-border bg-popover p-1 text-popover-foreground shadow-md outline-none', props.contentClass)}
          onBeforeToggle={event => { if (event.newState === 'closed') close(false, true) }} onKeyDown={keyDown}>
          <Show when={canScrollUp() || canScrollDown()}>
            <button type="button" tabindex={-1} aria-label="向上滚动选项" disabled={!canScrollUp()} class="flex h-6 w-full shrink-0 items-center justify-center disabled:opacity-30" onMouseDown={event => event.preventDefault()} onPointerEnter={() => startScrolling(-1)} onPointerLeave={stopScrolling} onClick={() => scroll(-1)}><span class="i-lucide:chevron-up text-4" /></button>
          </Show>
          <div ref={list} id={contentId} role="listbox" aria-label={props['aria-label'] ?? props.placeholder} aria-labelledby={props['aria-labelledby'] ?? (props['aria-label'] || props.placeholder ? undefined : triggerId())} class="min-h-0 overflow-y-auto overscroll-contain" onScroll={updateScroll}>
            <For each={entries()}>{(entry, index) => (
              <Show when={'options' in entry} fallback={<OptionRow option={entry as Option<T>} />}>
                <Show when={index() > 0}><div role="separator" class="-mx-1 my-1 h-px bg-border" /></Show>
                <div role="group" aria-label={entry.label}>
                  <div class="px-2 py-1.5 text-xs font-medium text-muted-foreground">{entry.label}</div>
                  <For each={'options' in entry ? entry.options : []}>{option => <OptionRow option={option} />}</For>
                </div>
              </Show>
            )}</For>
            <Show when={!options().length}><div class="px-2 py-3 text-sm text-muted-foreground">暂无选项</div></Show>
          </div>
          <Show when={canScrollUp() || canScrollDown()}>
            <button type="button" tabindex={-1} aria-label="向下滚动选项" disabled={!canScrollDown()} class="flex h-6 w-full shrink-0 items-center justify-center disabled:opacity-30" onMouseDown={event => event.preventDefault()} onPointerEnter={() => startScrolling(1)} onPointerLeave={stopScrolling} onClick={() => scroll(1)}><span class="i-lucide:chevron-down text-4" /></button>
          </Show>
        </div>
      </Portal>
    </>
  )
}
