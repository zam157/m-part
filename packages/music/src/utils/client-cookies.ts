import type { ProviderName } from '../types/provider'
import { TARGET_EXTENSION } from './constants'
import { normalizeClientCookie } from './cookie-header'
export { normalizeClientCookie, clientCookieValue } from './cookie-header'
import { providerCookieFilter } from './provider-request'
import { providerDefinitions } from './provider-definitions'

export const CLIENT_COOKIE_PREFIX = 'mpart-client-cookie:'
export const CLIENT_COOKIE_MODE_PREFIX = 'mpart-client-cookie-mode:'
export type ClientCookieMode = 'manual' | 'website'

export function getStoredClientCookie(provider: ProviderName): string {
  try { return globalThis.localStorage?.getItem(CLIENT_COOKIE_PREFIX + provider) ?? '' }
  catch { throw new Error('无法读取本机音源 Cookie 设置，请检查浏览器存储权限') }
}

function readMode(provider: ProviderName) {
  try { return globalThis.localStorage?.getItem(CLIENT_COOKIE_MODE_PREFIX + provider) ?? null }
  catch { throw new Error('无法读取本机音源 Cookie 设置，请检查浏览器存储权限') }
}
function resolveMode(mode: string | null, cookie: string): ClientCookieMode {
  // Preserve pre-selector settings without rewriting or deleting the saved Cookie.
  return mode === 'manual' || mode === 'website' ? mode : cookie ? 'manual' : 'website'
}
export function getClientCookieMode(provider: ProviderName): ClientCookieMode {
  return resolveMode(readMode(provider), getStoredClientCookie(provider))
}
/** Effective session only. Never fall back to a website account in manual mode. */
export function getClientCookie(provider: ProviderName): string {
  if (getClientCookieMode(provider) === 'website') return ''
  const cookie = getStoredClientCookie(provider)
  if (!cookie) throw new Error('尚未保存手动 Cookie，请先填写并保存，或切换为网站 Cookie')
  return cookie
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
  const config = providerDefinitions[provider].cookie
  if (!config) throw new Error('当前音源不支持手动 Cookie')
  return {
    id: config.ruleId, priority: 100,
    action: { type: 'modifyHeaders', requestHeaders: [{ header: 'cookie', operation: 'set', value: cookie }] },
    condition: { regexFilter: providerCookieFilter(config), initiatorDomains: [extensionId], resourceTypes: ['xmlhttprequest'] },
  }
}

let updates: Promise<unknown> = Promise.resolve()
/** Session rules are recreated before API requests after a browser / extension restart. */
export function syncClientCookie(provider: ProviderName, cookie: string): Promise<void> {
  const config = providerDefinitions[provider].cookie
  if (!config) return cookie ? Promise.reject(new Error('当前音源不支持手动 Cookie')) : Promise.resolve()
  if (!TARGET_EXTENSION) return Promise.resolve()
  const browser = (globalThis as typeof globalThis & { chrome?: CookieBrowser }).chrome
  if (!browser?.declarativeNetRequest || !browser.runtime?.id) {
    return cookie ? Promise.reject(new Error('当前扩展无法应用手动 Cookie，请重新加载扩展后重试')) : Promise.resolve()
  }
  const next = updates.then(async () => {
    try {
      // Rules are shared across extension tabs; a page-local cache can become stale.
      await browser.declarativeNetRequest!.updateSessionRules({
        removeRuleIds: [config.ruleId],
        addRules: cookie ? [clientCookieRule(provider, cookie, browser.runtime!.id!)] : [],
      })
    }
    catch { throw new Error('无法应用音源 Cookie，请重新加载扩展后重试') }
  })
  updates = next.catch(() => {})
  return next
}

async function updateClientCookie(provider: ProviderName, change: { cookie?: string, mode?: ClientCookieMode }) {
  if ((change.cookie || change.mode) && !providerDefinitions[provider].cookie) throw new Error('当前音源不支持手动 Cookie')
  const previous = getStoredClientCookie(provider), previousMode = readMode(provider)
  const cookie = change.cookie ?? previous
  const mode = change.mode ?? resolveMode(previousMode, previous)
  function write(key: string, value: string | null) {
    if (value) globalThis.localStorage.setItem(key, value)
    else globalThis.localStorage.removeItem(key)
  }
  function restore() {
    write(CLIENT_COOKIE_PREFIX + provider, previous)
    write(CLIENT_COOKIE_MODE_PREFIX + provider, previousMode)
  }
  try {
    if (change.cookie !== undefined) write(CLIENT_COOKIE_PREFIX + provider, cookie)
    write(CLIENT_COOKIE_MODE_PREFIX + provider, mode)
  }
  catch {
    try { restore() }
    catch { throw new Error('Cookie 保存失败，请重新加载页面后重试') }
    throw new Error('无法保存音源 Cookie，请检查浏览器存储权限')
  }
  try { await syncClientCookie(provider, mode === 'manual' ? cookie : '') }
  catch (error) {
    try { restore(); await syncClientCookie(provider, resolveMode(previousMode, previous) === 'manual' ? previous : '') }
    catch { throw new Error('Cookie 保存失败，请重新加载扩展后重试') }
    throw error
  }
}

/** Saving or clearing a value leaves the selected source unchanged. */
export async function setClientCookie(provider: ProviderName, value: string) {
  return updateClientCookie(provider, { cookie: normalizeClientCookie(value) })
}
export function setClientCookieMode(provider: ProviderName, mode: ClientCookieMode) {
  if (mode !== 'manual' && mode !== 'website') return Promise.reject(new Error('Cookie 来源无效'))
  return updateClientCookie(provider, { mode })
}
