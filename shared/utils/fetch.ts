import { TARGET_EXTENSION, USE_GM_FETCH, USE_PROXY } from './constants'

export type TRequestErrorTuple = [isOk: false, status: number, statusText: string]
export type TRequestSuccessTuple<T> = [isOk: true, data: T]
export type TRequestResult<T> = TRequestErrorTuple | TRequestSuccessTuple<T>

type TRequestOptions = Omit<RequestInit, 'body'> & {
  body?: Record<string, any> | undefined | null
  searchParams?: Record<string, any> | undefined | null
  url?: null | undefined
  returnJson?: boolean
}

export const CUSTOM_HEADER_PREFIX = 'custom-'
const CUSTOM_HEADER_KEY_NAME_WHITE_LIST = ['cookie', 'origin', 'referer', 'user-agent']

const globalWindow = (globalThis as any).window

/**
 * fetch 规范下禁止设置（或本应由浏览器自行管理）的请求头。
 *
 * 扩展形态下这些头一律不自己传：
 * - `user-agent` / `accept-encoding` 由浏览器按真实环境生成
 * - `referer` / `origin` 由 declarativeNetRequest 规则注入（见 extension/rules/）
 * - `cookie` 由凭据机制携带（`credentials: 'include'`）
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
 * 携带的，调用方既不需要也无法手动拼 Cookie。调用方显式指定的 `credentials`
 * 优先，便于个别请求改走匿名。
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
  let
    body: string | undefined
  let fetchFn: typeof fetch = fetch

  if (options) {
    if (options.body)
      body = JSON.stringify(options.body)

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

  const res = await fetchFn(url, fetchOptions)

  if (!res.ok)
    return [false, res.status, res.statusText]

  if (options?.returnJson ?? true)
    return [true, await res.json()]

  return [true, res]
}
