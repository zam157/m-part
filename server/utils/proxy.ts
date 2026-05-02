import { CUSTOM_HEADER_PREFIX } from '#shared/utils/fetch'

export function parseProxyRequestHeaders(headers: Headers) {
  const proxyHeaders = new Headers(headers)
  proxyHeaders.delete('host')

  for (const [key, value] of headers) {
    if (key.startsWith(CUSTOM_HEADER_PREFIX)) {
      const targetKey = key.slice(CUSTOM_HEADER_PREFIX.length)
      proxyHeaders.set(targetKey, value)
      proxyHeaders.delete(key)
    }
  }

  return proxyHeaders
}
