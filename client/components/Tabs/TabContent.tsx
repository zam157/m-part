import type { JSX } from '@solidjs/web'
import { useTabsContext } from './tabs-context'

export interface TabContentProps {
  value: string
  class?: string
  children?: JSX.Element
}

export default function TabContent(props: TabContentProps) {
  const { activeTab } = useTabsContext()

  // 等价于原实现的 v-show：保持挂载，仅切换 display
  return (
    <div
      class={props.class}
      style={{ display: activeTab() === props.value ? undefined : 'none' }}
    >
      {props.children}
    </div>
  )
}
