import { defineBackground } from 'wxt/utils/define-background'
import { registerWebBridge } from '../utils/web-bridge'

/**
 * 扩展 service worker。
 *
 * 扩展页面直接请求音源，允许的网页通过 Web bridge 请求同一套 Provider。
 *
 * 注意：WXT 会在构建期用 Node 加载这个文件，所以运行时逻辑必须写在回调里，
 * 不能放在模块顶层。
 */
export default defineBackground(() => {
  registerWebBridge()
  /** 应用页在扩展内的路径，对应 `entrypoints/app/index.html` */
  const APP_PAGE = 'app.html'

  chrome.action.onClicked.addListener(() => {
    void chrome.tabs.create({ url: chrome.runtime.getURL(APP_PAGE) })
  })

  chrome.runtime.onInstalled.addListener(() => {
    void chrome.declarativeNetRequest.getEnabledRulesets().then((rulesetIds) => {
      console.info('[m-part] enabled declarativeNetRequest rulesets:', rulesetIds)
    })
  })
})
