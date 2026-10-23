import type { Provider, ProviderName } from '../../types/provider'
import BiliProvider from './bilibili'
import NeteaseProvider from './netease'
import QQProvider from './qq'

export const providers: Record<ProviderName, Provider> = {
  bili: BiliProvider,
  netease: NeteaseProvider,
  qq: QQProvider,
}
