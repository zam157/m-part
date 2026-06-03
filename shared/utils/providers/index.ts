import type { Provider, ProviderName } from '#shared/types/provider'
import BiliProvider from './bilibili'

export const providers: Record<ProviderName, Provider> = {
  bili: BiliProvider,
}
