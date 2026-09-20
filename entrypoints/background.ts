import { defineBackground } from 'wxt/utils/define-background'

/**
 * 扩展 service worker。
 *
 * 这里刻意保持极薄：网络请求由扩展页面直接发起（扩展源 + manifest 里的
 * `host_permissions` 不受 CORS 限制），`referer` / `origin` 由
 * `declarativeNetRequest` 规则注入（见 `public/rules/bilibili.json`），
 * 登录凭据由 `credentials: 'include'` 自动携带。
 *
 * 注意：WXT 会在构建期用 Node 加载这个文件，所以运行时逻辑必须写在回调里，
 * 不能放在模块顶层。
 */
export default defineBackground(() => {
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
