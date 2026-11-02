import type { ProviderCookieConfig, ProviderDefinition, ProviderName } from '../types/provider'
import { biliDefinition } from './providers/bilibili-definition'
import { neteaseDefinition } from './providers/netease-definition'
import { qqDefinition } from './providers/qq-definition'

// Metadata only: fetch / Web forwarder must never load the Provider implementations.
export const providerDefinitions: Record<ProviderName, ProviderDefinition> = {
  netease: neteaseDefinition,
  qq: qqDefinition,
  bili: biliDefinition,
}

export function getCookieProviders(): { name: ProviderName, cookie: ProviderCookieConfig }[] {
  return Object.values(providerDefinitions).flatMap(definition => definition.cookie ? [{ name: definition.name, cookie: definition.cookie }] : [])
}

export function websiteCookieUrls(cookie: ProviderCookieConfig): readonly string[] {
  return cookie.session?.urls ?? [cookie.loginUrl]
}

/** Chrome filters Cookies by their own domain and Secure flag, not just the query URL. */
export function websiteCookiePermissions(cookie?: ProviderCookieConfig): string[] {
  const configs = cookie ? [cookie] : getCookieProviders().map(item => item.cookie)
  const hosts = configs.filter(config => config.session).flatMap(config => [
    ...websiteCookieUrls(config).map(url => new URL(url).hostname),
    ...config.session!.domains,
  ])
  // Both schemes are needed for Secure and non-Secure Cookies. Keep hosts exact.
  return [...new Set(hosts.map(host => `*://${host}/*`))]
}
