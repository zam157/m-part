import { TARGET_EXTENSION, USE_GM_FETCH } from './constants'
import { providerMedia } from './provider-request'

export type WebTransport = 'proxy' | 'extension'

const TRANSPORT_KEY = 'mpart-web-transport'
export const WEB_BRIDGE_PORT = 'm-part-web-v1'
export const EXTENSION_ID = 'cjkjimmicmbpjjbopadpdfgpgmgobddl'

export const usesWebTransport = () => !TARGET_EXTENSION && !(USE_GM_FETCH && typeof window !== 'undefined' && '__tFetch' in window)

export function getWebTransport(): WebTransport {
  return globalThis.localStorage?.getItem(TRANSPORT_KEY) === 'extension' ? 'extension' : 'proxy'
}

export function setWebTransport(mode: WebTransport) {
  localStorage.setItem(TRANSPORT_KEY, mode)
}

export function webMediaProxyUrl(url: string): string | undefined {
  if (usesWebTransport() && getWebTransport() === 'proxy' && providerMedia(url))
    return '/api/provider-media?' + new URLSearchParams({ url })
}
