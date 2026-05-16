import { USE_GM_FETCH, USE_PROXY } from './constants'

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
