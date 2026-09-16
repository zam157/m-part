import type { JSX } from '@solidjs/web'
import { For } from 'solid-js'
import { TabsContext } from './tabs-context'

export interface Tab<T extends string> {
  value: T
  label: string
  disabled?: boolean
}

export interface TabsProps<T extends string> {
  tabs: Tab<T>[]
  modelValue?: T
  onModelValueChange?: (value: T) => void
  class?: string
  children?: JSX.Element
}

export default function Tabs<T extends string>(props: TabsProps<T>) {
  const activeTab = () => props.modelValue ?? props.tabs[0]?.value

  function setActiveTab(value: string) {
    props.onModelValueChange?.(value as T)
  }

  function handleTabClick(tabValue: T) {
    const tab = props.tabs.find(t => t.value === tabValue)
    if (!tab?.disabled)
      setActiveTab(tabValue)
  }

  function tabClass(tab: Tab<T>) {
    return [
      'uno-layer-components:(px-1.5 py-0.5 text-sm font-medium transition-all rounded-md outline-none)',
      activeTab() === tab.value
        ? 'uno-layer-components:(bg-background text-foreground shadow-sm)'
        : 'uno-layer-components:(text-muted-foreground)',
      tab.disabled
        ? 'uno-layer-components:(cursor-not-allowed opacity-50)'
        : 'uno-layer-components:(hover:text-foreground)',
    ].join(' ')
  }

  return (
    <TabsContext value={{ activeTab, setActiveTab }}>
      <div
        class={`uno-layer-components:(flex gap-1 rounded-lg bg-muted p-[3px] w-fit) ${props.class ?? ''}`.trim()}
        role="tablist"
      >
        <For each={props.tabs}>
          {tab => (
            <button
              type="button"
              role="tab"
              aria-selected={activeTab() === tab.value ? 'true' : 'false'}
              disabled={tab.disabled}
              class={tabClass(tab)}
              onClick={() => handleTabClick(tab.value)}
            >
              {tab.label}
            </button>
          )}
        </For>
      </div>

      {/* 选项卡内容由使用者作为 children 传入 */}
      {props.children}
    </TabsContext>
  )
}
