import type { Provider, ProviderName } from '#shared/types/provider'
import BiliProvider from './bilibili'
import NeteaseProvider from './netease'

export const providers: Record<ProviderName, Provider> = {
  bili: BiliProvider,
  netease: NeteaseProvider,
}
