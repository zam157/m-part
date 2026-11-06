import type { Provider, ProviderName } from '../../types/provider'
import BiliProvider from './bilibili'
import NeteaseProvider from './netease'
import QQProvider from './qq'
import { withWebBridge } from '../web-bridge'

export const providers: Record<ProviderName, Provider> = {
  bili: withWebBridge(BiliProvider),
  netease: withWebBridge(NeteaseProvider),
  qq: withWebBridge(QQProvider),
}
