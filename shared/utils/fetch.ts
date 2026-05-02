export type ErrorTuple = [isOk: false, status: number, statusText: string]
export type SuccessTuple<T> = [isOk: true, data: T]
export type FetchResult<T> = ErrorTuple | SuccessTuple<T>

type TFetchOptions = Omit<RequestInit, 'body'> & {
  body?: Record<string, any> | undefined | null
}
export async function tFetch<T = unknown>(url: RequestInfo | URL, options?: TFetchOptions): Promise<FetchResult<T>> {
  const body = options?.body ? JSON.stringify(options.body) : undefined
  const res = await fetch(url, body ? { ...options, body } : options as RequestInit)
  if (!res.ok)
    return [false, res.status, res.statusText]
  return [true, await res.json()]
}
