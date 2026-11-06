import type { ProviderCookieConfig } from '../types/provider'
import { getCookieProviders, providerDefinitions } from './provider-definitions'

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

export function providerMedia(value: string) {
  let url: URL
  try { url = new URL(value) }
  catch { return }
  if (url.protocol !== 'https:' || url.username || url.password || url.hash) return
  for (const definition of Object.values(providerDefinitions)) {
    const media = definition.media
    if (!media || (url.port && !media.ports?.includes(url.port))) continue
    if (media.domains.some(domain => url.hostname === domain || url.hostname.endsWith(`.${domain}`)))
      return { provider: definition.name, url, referer: media.referer }
  }
}

/** Relay only media metadata, never upstream cookies, redirects or authentication headers. */
export function mediaResponseHeaders(headers: Headers) {
  const result = new Headers()
  for (const name of ['content-type', 'content-length', 'content-range', 'accept-ranges']) {
    const value = headers.get(name)
    if (value !== null) result.set(name, value)
  }
  return result
}

export function isMediaContentType(headers: Headers) {
  const type = headers.get('content-type')?.split(';')[0]?.trim().toLowerCase()
  return !type || type.startsWith('audio/') || ['application/octet-stream', 'application/ogg', 'video/mp4', 'video/webm'].includes(type)
}
