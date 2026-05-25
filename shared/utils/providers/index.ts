import type { Provider, ProviderName } from '#shared/types/provider'
import BiliProvider from './bilibili'

export const providers = {
  bili: BiliProvider,
} as const satisfies Record<ProviderName, Provider>
