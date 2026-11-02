import type { ProviderCookieConfig } from '../types/provider'
import { getCookieProviders } from './provider-definitions'

const escapeRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/** Generate the DNR scope from the same targets used by the Web allowlist. */
export function providerCookieFilter(cookie: ProviderCookieConfig): string {
  return `^(${cookie.targets.map(target => `${escapeRegex(target.origin + target.path)}${target.exact ? '([?]|$)' : ''}`).join('|')})`
}

/** API destinations only; never classify artwork, audio CDNs or a room server as a credential target. */
export function providerRequest(value: string) {
  let url: URL
  try { url = new URL(value) }
  catch { return }
  if (url.protocol !== 'https:' || url.port || url.username || url.password || url.hash) return
  for (const { name, cookie } of getCookieProviders()) {
    if (cookie.targets.some(target => url.origin === target.origin && (target.exact ? url.pathname === target.path : url.pathname.startsWith(target.path)))) {
      return { provider: name, cookie, url }
    }
  }
}
