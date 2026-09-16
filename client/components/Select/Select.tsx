import type { Option } from './type'
import { createMemo, createSignal, For, Show } from 'solid-js'
import Popover, { type PopoverApi } from '../Popover/Popover'

export interface SelectProps<T> {
  disabled?: boolean
  placeholder?: string
  options: readonly Option<T>[]
  /** 追加到弹出容器的行内样式（与内置样式无关，直接透传） */
  contentStyle?: string
  /** 追加到触发器的工具类 */
  triggerClass?: string
  renderContentFirstLoad?: boolean
  /** 当前选中值（替代 v-model） */
  value: T
  /** 选中值变化回调 */
  onValueChange?: (value: T) => void
}

export default function Select<T>(props: SelectProps<T>) {
  let popover: PopoverApi | undefined
  const [isFirstLoad, setIsFirstLoad] = createSignal(true)

  const selectedOption = createMemo(() => props.options.find(option => option.value === props.value))
  const renderContent = createMemo(() => props.renderContentFirstLoad || !isFirstLoad())

  function select(option: Option<T>) {
    if (option.disabled)
      return
    props.onValueChange?.(option.value)
    popover?.hide()
  }

  return (
    <Popover
      ref={api => (popover = api)}
      triggerTag="button"
      triggerAttrs={{
        disabled: props.disabled,
        type: 'button',
        class: `border-btn justify-between h-full pl-2 pr-1 py-1 text-xs ${props.triggerClass ?? ''}`.trim(),
      }}
      contentAttrs={{
        class: 'w-24 max-h-80 overflow-y-auto p-1 mt-1',
        style: `top:anchor(bottom);${props.contentStyle ?? ''}`,
      }}
      onBeforeToggle={(event) => {
        if (event.newState === 'open' && isFirstLoad())
          setIsFirstLoad(false)
      }}
      trigger={(
        <>
          {selectedOption()?.label ?? props.placeholder ?? 'Select an option'}
          <div class="i-lucide:chevron-down text-4" />
        </>
      )}
      content={(
        <Show when={renderContent()}>
          <div class="flex flex-col w-full">
            <For each={props.options}>
              {option => (
                <div
                  class={`ghost-btn flex items-center pl-1.5 pr-8 py-1 text-3.5 w-full ${option.disabled ? 'opacity-50 cursor-not-allowed' : ''}`.trim()}
                  onClick={() => select(option)}
                >
                  <span class="w-full truncate">{option.label}</span>
                  <Show when={props.value === option.value}>
                    <div class="i-lucide:check text-4 shrink-0 grow-0 absolute right-2" />
                  </Show>
                </div>
              )}
            </For>
          </div>
        </Show>
      )}
    />
  )
}
