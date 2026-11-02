import type { ProviderName } from '../types/provider'
import { TARGET_EXTENSION } from './constants'
import { normalizeClientCookie } from './cookie-header'
export { normalizeClientCookie, clientCookieValue } from './cookie-header'
import { providerCookieFilters } from './provider-request'

export const CLIENT_COOKIE_PREFIX = 'mpart-client-cookie:'
const ruleIds = { bili: 11001, netease: 11002, qq: 11003 } as const

export function getClientCookie(provider: ProviderName): string {
  try { return globalThis.localStorage?.getItem(CLIENT_COOKIE_PREFIX + provider) ?? '' }
  catch { throw new Error('无法读取本机音源 Cookie 设置，请检查浏览器存储权限') }
}

export interface CookieRule {
  id: number
  priority: number
  action: { type: 'modifyHeaders', requestHeaders: { header: string, operation: 'set', value: string }[] }
  condition: { regexFilter: string, initiatorDomains: string[], resourceTypes: ['xmlhttprequest'] }
}
interface CookieBrowser {
  runtime?: { id?: string }
  declarativeNetRequest?: { updateSessionRules: (options: { removeRuleIds: number[], addRules: CookieRule[] }) => Promise<void> }
}
export function clientCookieRule(provider: ProviderName, cookie: string, extensionId: string): CookieRule {
  return {
    id: ruleIds[provider], priority: 100,
    action: { type: 'modifyHeaders', requestHeaders: [{ header: 'cookie', operation: 'set', value: cookie }] },
    condition: { regexFilter: providerCookieFilters[provider], initiatorDomains: [extensionId], resourceTypes: ['xmlhttprequest'] },
  }
}

let updates: Promise<unknown> = Promise.resolve()
/** Session rules are recreated before API requests after a browser / extension restart. */
export function syncClientCookie(provider: ProviderName, cookie: string): Promise<void> {
  if (!TARGET_EXTENSION) return Promise.resolve()
  const browser = (globalThis as typeof globalThis & { chrome?: CookieBrowser }).chrome
  if (!browser?.declarativeNetRequest || !browser.runtime?.id) {
    return cookie ? Promise.reject(new Error('当前扩展无法应用手动 Cookie，请重新加载扩展后重试')) : Promise.resolve()
  }
  const next = updates.then(async () => {
    try {
      // Rules are shared across extension tabs; a page-local cache can become stale.
      await browser.declarativeNetRequest!.updateSessionRules({
        removeRuleIds: [ruleIds[provider]],
        addRules: cookie ? [clientCookieRule(provider, cookie, browser.runtime!.id!)] : [],
      })
    }
    catch { throw new Error('无法应用音源 Cookie，请重新加载扩展后重试') }
  })
  updates = next.catch(() => {})
  return next
}

export async function setClientCookie(provider: ProviderName, value: string) {
  const cookie = normalizeClientCookie(value), previous = getClientCookie(provider)
  function store(next: string) {
    if (next) globalThis.localStorage.setItem(CLIENT_COOKIE_PREFIX + provider, next)
    else globalThis.localStorage.removeItem(CLIENT_COOKIE_PREFIX + provider)
  }
  try { store(cookie) }
  catch { throw new Error('无法保存音源 Cookie，请检查浏览器存储权限') }
  try { await syncClientCookie(provider, cookie) }
  catch (error) {
    try { store(previous); await syncClientCookie(provider, previous) }
    catch { throw new Error('Cookie 保存失败，请重新加载扩展后重试') }
    throw error
  }
}
