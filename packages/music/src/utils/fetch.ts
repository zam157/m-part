import { TARGET_EXTENSION, USE_GM_FETCH, USE_PROXY } from './constants'
import { CUSTOM_HEADER_PREFIX } from '../proxy-headers'
import { getClientCookie, syncClientCookie } from './client-cookies'
import { providerRequest } from './provider-request'

export type TRequestErrorTuple = [isOk: false, status: number, statusText: string]
export type TRequestSuccessTuple<T> = [isOk: true, data: T]
export type TRequestResult<T> = TRequestErrorTuple | TRequestSuccessTuple<T>

type TRequestOptions = Omit<RequestInit, 'body'> & {
  body?: Record<string, any> | URLSearchParams | undefined | null
  searchParams?: Record<string, any> | undefined | null
  url?: null | undefined
  returnJson?: boolean
  /** Read structured error payloads from controlled APIs without discarding their body. */
  acceptHttpErrors?: boolean
  /** Provider auth fields must be derived from the same cookie selection as the HTTP request. */
  cookieContext?: string
}

export { CUSTOM_HEADER_PREFIX } from '../proxy-headers'
const CUSTOM_HEADER_KEY_NAME_WHITE_LIST = ['cookie', 'origin', 'referer', 'user-agent']

const globalWindow = (globalThis as any).window

/**
 * fetch 规范下禁止设置（或本应由浏览器自行管理）的请求头。
 *
 * 扩展形态下这些头一律不自己传：
 * - `user-agent` / `accept-encoding` 由浏览器按真实环境生成
 * - `referer` / `origin` 由 declarativeNetRequest 规则注入（见 extension/rules/）
 * - `cookie` 默认由凭据机制携带；手动设置时由受限 DNR 会话规则替换
 */
const FORBIDDEN_REQUEST_HEADERS = new Set([
  'accept-encoding',
  'connection',
  'content-length',
  'cookie',
  'host',
  'origin',
  'referer',
  'user-agent',
])

/**
 * 扩展形态的传输策略：剥掉自己传不了的请求头，改由浏览器凭据与 DNR 规则接管。
 *
 * 默认 `credentials: 'include'`：登录态（如 bilibili 的 SESSDATA）正是靠它自动
 * 携带的。手动 Cookie 统一由下方的平台策略应用，不在 Provider 中拼请求头。
 * 未设置手动 Cookie 时保留调用方显式指定的 `credentials`。
 */
function applyExtensionPolicy(fetchOptions: Record<string, any>) {
  if (fetchOptions.headers) {
    const headers = new Headers(fetchOptions.headers)
    // 迭代中删除条目的行为未定义，先把 key 收集出来
    for (const key of [...headers.keys()]) {
      if (FORBIDDEN_REQUEST_HEADERS.has(key))
        headers.delete(key)
    }
    fetchOptions.headers = headers
  }

  fetchOptions.credentials ??= 'include'
}

export async function tRequest(url: string, options?: Omit<TRequestOptions, 'returnJson'> & { returnJson: false }): Promise<TRequestResult<Response>>
export async function tRequest<T = unknown>(url: string, options?: Omit<TRequestOptions, 'returnJson'> & { returnJson?: true | undefined }): Promise<TRequestResult<T>>
export async function tRequest(url: string, options?: TRequestOptions): Promise<TRequestResult<any>> {
  const legacyBiliProxy = url.startsWith('/api/proxy/bili/')
  let
    body: string | undefined
  let fetchFn: typeof fetch = fetch

  if (options) {
    if (options.body)
      body = options.body instanceof URLSearchParams ? options.body.toString() : JSON.stringify(options.body)

    if (options.searchParams && Object.keys(options.searchParams).length > 0) {
      const newUrl = new URL(url, globalWindow?.location.origin)

      const searchParams = new URLSearchParams(options.searchParams)
      for (const [key, value] of searchParams) {
        newUrl.searchParams.append(key, value)
      }

      url = newUrl.toString()
    }
  }

  const fetchOptions: any = { ...options }
  delete fetchOptions.searchParams
  delete fetchOptions.url
  delete fetchOptions.acceptHttpErrors
  delete fetchOptions.cookieContext

  if (USE_GM_FETCH && globalWindow?.__tFetch) {
    fetchFn = globalWindow.__tFetch
  }

  // 扩展形态：跨域由 host_permissions 解决，forbidden header 交给 DNR 与凭据机制
  else if (TARGET_EXTENSION) {
    applyExtensionPolicy(fetchOptions)
  }

  // 如果启用了代理，则将特定的 header 转换为约定前缀的 header，供代理服务器使用
  else if (USE_PROXY) {
    if (fetchOptions.headers) {
      const newHeaders = new Headers(fetchOptions.headers)
      for (const [key, value] of newHeaders) {
        if (!CUSTOM_HEADER_KEY_NAME_WHITE_LIST.includes(key))
          continue
        newHeaders.set(CUSTOM_HEADER_PREFIX + key, value)
        newHeaders.delete(key)
      }
      fetchOptions.headers = newHeaders
    }
  }

  if (body)
    fetchOptions.body = body

  // The legacy Web Bili entry uses a relative proxy URL; classify its official destination.
  const proxyUrl = legacyBiliProxy ? new URL(url, globalWindow?.location.origin) : undefined
  const target = providerRequest(proxyUrl ? `https://api.bilibili.com${proxyUrl.pathname.slice('/api/proxy/bili'.length)}${proxyUrl.search}` : url)
  const cookie = target ? getClientCookie(target.provider) : ''
  if (target && options?.cookieContext !== undefined && options.cookieContext !== cookie) throw new Error('音源 Cookie 已更新，请重试当前操作')
  if (target) fetchOptions.credentials ??= 'include'
  if (target && TARGET_EXTENSION) await syncClientCookie(target.provider, cookie)
  fetchOptions.signal?.throwIfAborted()
  if (cookie) {
    // Never mix website cookies or write the response's Set-Cookie into that website's jar.
    fetchOptions.credentials = 'omit'
    if (USE_GM_FETCH && globalWindow?.__tFetch) {
      const headers = new Headers(fetchOptions.headers)
      headers.set('cookie', cookie)
      fetchOptions.headers = headers
    }
    else if (!TARGET_EXTENSION) {
      const headers = Object.fromEntries(new Headers(options?.headers))
      fetchOptions.method = 'POST'
      fetchOptions.headers = { 'content-type': 'application/json' }
      fetchOptions.body = JSON.stringify({ url: target!.url.href, method: options?.method ?? 'GET', headers, body, cookie })
      url = '/api/provider-request'
    }
  }
  if (target && getClientCookie(target.provider) !== cookie) throw new Error('音源 Cookie 已更新，请重试当前操作')
  const res = await fetchFn(url, fetchOptions)
  if (target && getClientCookie(target.provider) !== cookie) { void res.body?.cancel(); throw new Error('音源 Cookie 已更新，请重试当前操作') }

  if (!res.ok && !options?.acceptHttpErrors)
    return [false, res.status, res.statusText]

  if (options?.returnJson ?? true) {
    const data = await res.json()
    if (target && getClientCookie(target.provider) !== cookie) throw new Error('音源 Cookie 已更新，请重试当前操作')
    return [true, data]
  }

  return [true, res]
}
