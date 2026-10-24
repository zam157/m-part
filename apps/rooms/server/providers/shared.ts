import type { HostedPlatform } from '@m-part/listen-core/protocol'

export class HostedSourceError extends Error {
  constructor(message: string, readonly invalidCredential = false, readonly diagnostics: HostedDiagnostics = {}, options?: ErrorOptions) { super(message, options) }
}
export interface HostedDiagnostics {
  provider?: HostedPlatform
  phase?: 'api' | 'cdn' | 'resolve'
  endpoint?: string
  httpStatus?: number
  upstreamCodes?: unknown[]
}

/** Retain diagnostic metadata, never upstream bodies, URLs or request headers. */
export async function withUpstreamDiagnostics<T>(details: HostedDiagnostics, operation: (details: HostedDiagnostics) => Promise<T>): Promise<T> {
  try { return await operation(details) }
  catch (error) {
    if (error instanceof HostedSourceError) { Object.assign(error.diagnostics, details); throw error }
    throw new HostedSourceError('房间上游请求失败，请稍后重试', false, details, { cause: error })
  }
}
export interface HostedResource { url: string, hash?: string, size?: number }
export interface HostedProvider {
  parseCookie: (input: string) => string
  validateMediaUrl: (input: string) => string
  mediaHeaders?: Readonly<Record<string, string>>
  acceptsMediaType?: (type: string) => boolean
  validate: (cookie: string, signal: AbortSignal) => Promise<string>
  /** Empty cookie means an anonymous request; validation is only for explicit bindings. */
  resolve: (cookie: string, id: string, signal: AbortSignal) => Promise<HostedResource>
}
export type HostedProviders = Record<HostedPlatform, HostedProvider>

/** Bounded, allowlisted Cookie fields; never forward unrelated browser sessions. */
export function selectedCookies(input: string, names: readonly string[]) {
  if (input.length > 4096 || /[\r\n\x00-\x1f\x7f]/.test(input)) throw new HostedSourceError('登录凭据格式不正确')
  const result = new Map<string, string>()
  for (const part of input.split(';')) {
    const at = part.indexOf('=')
    if (at < 1) continue
    const name = part.slice(0, at).trim(); const value = part.slice(at + 1).trim()
    if (!names.includes(name)) continue
    if (result.has(name) || !/^[\w%+/.=:@-]{1,2048}$/.test(value)) throw new HostedSourceError('登录凭据格式不正确')
    result.set(name, value)
  }
  return result
}
export function cookieHeader(cookies: Map<string, string>) { return [...cookies].map(([key, value]) => `${key}=${value};`).join(' ') }

/** Reject credentials, ports, local hosts and sibling/suffix tricks on every hop. */
export function mediaUrl(input: string, platform: string, domains: readonly string[]) {
  let url: URL
  try { url = new URL(input.startsWith('//') ? `https:${input}` : input) }
  catch { throw new HostedSourceError(`${platform}音源地址无效`) }
  if (url.protocol === 'http:') url.protocol = 'https:'
  if (url.protocol !== 'https:' || url.username || url.password || url.port || url.hash || !domains.some(domain => url.hostname === domain || url.hostname.endsWith(`.${domain}`))) throw new HostedSourceError(`房间音源地址不在允许的${platform} CDN 范围内`)
  return url.href
}

export async function limitedJson(response: Response, platform: string) {
  const reader = response.body?.getReader()
  if (!reader) throw new HostedSourceError(`${platform}返回了无效响应`)
  const chunks: Uint8Array[] = []
  let length = 0
  try {
    while (true) {
      const value = await reader.read()
      if (value.done) break
      length += value.value.byteLength
      if (length > 128 * 1024) throw new HostedSourceError(`${platform}返回了过大的响应`)
      chunks.push(value.value)
    }
    return JSON.parse(Buffer.concat(chunks).toString())
  }
  catch (error) {
    await reader.cancel().catch(() => {})
    if (error instanceof HostedSourceError) throw error
    throw new HostedSourceError(`${platform}返回了无效响应`)
  }
}

