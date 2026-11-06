import type { ProviderName } from '../types/provider'
import { TARGET_EXTENSION } from './constants'
import { normalizeClientCookie, clientCookieValue } from './cookie-header'
export { normalizeClientCookie, clientCookieValue } from './cookie-header'
import { providerCookieFilter } from './provider-request'
import { getWebTransport, usesWebTransport } from './web-transport'
import { providerDefinitions, getCookieProviders, websiteCookieUrls, websiteCookiePermissions } from './provider-definitions'

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

/** Explicit host operation: export only declared login fields from the active session. */
export async function getClientSessionCookie(provider: ProviderName): Promise<string> {
  if (usesWebTransport() && getWebTransport() === 'extension') return ''
  const config = providerDefinitions[provider].cookie
  if (!config?.session) return ''
  const mode = getClientCookieMode(provider)
  const selected = getStoredClientCookie(provider)
  let cookie = ''
  if (mode === 'manual') cookie = getClientCookie(provider)
  else {
    if (!TARGET_EXTENSION) return ''
    const browser = (globalThis as any).chrome
    const api = browser?.cookies
    if (!api?.getAll) throw new Error('无法读取网站登录 Cookie，请重新加载扩展并检查权限')
    try {
      if (browser.permissions?.contains && !await browser.permissions.contains({ permissions: ['cookies'], origins: websiteCookiePermissions(config) })) throw new Error()
    }
    catch { throw new Error('无法完整读取网站登录 Cookie，请重新加载扩展并允许访问音源网站') }
    let readFailed = false, partialSession = false
    for (const url of websiteCookieUrls(config)) {
      try {
        const cookies: { name: string, value: string, path: string }[] = await api.getAll({ url })
        const candidate = cookies.filter(item => config.session!.names.includes(item.name)).sort((a, b) => b.path.length - a.path.length).map(item => `${item.name}=${item.value}`).join('; ')
        if (config.session.required.every(group => group.some(name => !!clientCookieValue(candidate, name)))) { cookie = candidate; break }
        if ((config.session.loginIndicators ?? config.session.required.flat()).some(name => !!clientCookieValue(candidate, name))) partialSession = true
      }
      catch { readFailed = true }
    }
    if (!cookie && readFailed) throw new Error('无法完整读取网站登录 Cookie，请重新加载扩展并允许访问音源网站')
    if (!cookie && partialSession) throw new Error('网站登录 Cookie 不完整，请重新登录音源网站后重试')
  }
  if (mode !== getClientCookieMode(provider) || (mode === 'manual' && selected !== getStoredClientCookie(provider))) throw new Error('音源 Cookie 已更新，请重试当前操作')
  const fields = config.session.names.map(name => [name, clientCookieValue(cookie, name)] as const).filter(([, value]) => value)
  if (!config.session.required.every(group => group.some(name => fields.some(([field]) => field === name)))) {
    if (mode === 'manual') throw new Error('手动 Cookie 缺少登录字段，请在音源设置中更新')
    return ''
  }
  const result = normalizeClientCookie(fields.map(([name, value]) => `${name}=${value}`).join('; '))
  if (result.length > 4096) throw new Error('登录 Cookie 过长，无法用于房间托管')
  return result
}

/** Observes names/domains only; never expose Cookie values in change notifications. */
export function watchWebsiteSessionCookies(changed: (provider: ProviderName) => void) {
  const events = (globalThis as any).chrome?.cookies?.onChanged
  if (!TARGET_EXTENSION || !events) return () => {}
  const pending = new Set<ProviderName>()
  let timer: ReturnType<typeof setTimeout> | undefined
  const listener = ({ cookie }: { cookie: { name: string, domain: string } }) => {
    for (const { name, cookie: config } of getCookieProviders()) {
      const domain = cookie.domain.replace(/^\./, '')
      const inScope = websiteCookieUrls(config).some(url => { const host = new URL(url).hostname; return host === domain || host.endsWith(`.${domain}`) })
      if (getClientCookieMode(name) === 'website' && config.session?.names.includes(cookie.name) && inScope) pending.add(name)
    }
    if (!pending.size) return
    clearTimeout(timer)
    // Chrome emits remove + add for an overwrite; do not briefly export an anonymous session.
    timer = setTimeout(() => { for (const provider of pending) if (getClientCookieMode(provider) === 'website') changed(provider); pending.clear() }, 100)
  }
  events.addListener(listener)
  return () => { clearTimeout(timer); pending.clear(); events.removeListener(listener) }
}

export interface CookieRule {
  id: number
  priority: number
  action: { type: 'modifyHeaders', requestHeaders: { header: string, operation: 'set', value: string }[] }
  condition: { regexFilter: string, initiatorDomains: string[], excludedTabIds: number[], resourceTypes: ['xmlhttprequest'] }
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
    condition: { regexFilter: providerCookieFilter(config), initiatorDomains: [extensionId], excludedTabIds: [-1], resourceTypes: ['xmlhttprequest'] },
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
