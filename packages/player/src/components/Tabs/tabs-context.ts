import { createContext, useContext } from 'solid-js'

export interface TabsContextValue {
  activeTab: () => string | undefined
  setActiveTab: (value: string) => void
}

/**
 * `Tabs` 与 `TabContent` 之间的通信。
 * Solid 没有 provide/inject，用 context 代替。
 */
export const TabsContext = createContext<TabsContextValue>()

export function useTabsContext(): TabsContextValue {
  return useContext(TabsContext)
}
