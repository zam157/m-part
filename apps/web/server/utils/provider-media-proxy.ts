import { isMediaContentType, mediaResponseHeaders, providerMedia } from '@m-part/music/provider-request'

const fail = (status: number, message: string) => Response.json({ message }, { status, headers: { 'cache-control': 'no-store' } })

export async function providerMediaProxy(request: Request, fetcher: typeof fetch = fetch): Promise<Response> {
  if (request.method !== 'GET' && request.method !== 'HEAD') return fail(405, '不支持的请求方法')
  const site = request.headers.get('sec-fetch-site')
  if (site && site !== 'same-origin' && site !== 'none') return fail(403, '不允许跨站播放代理音频')
  const initial = providerMedia(new URL(request.url).searchParams.get('url') ?? '')
  if (!initial) return fail(403, '不支持的音频地址')
  const headers = new Headers({ referer: initial.referer, 'accept-encoding': 'identity' })
  const range = request.headers.get('range')
  if (range) {
    if (!/^bytes=(?:\d+-\d*|-\d+)$/.test(range)) return fail(416, '不支持的音频范围')
    headers.set('range', range)
  }

  try {
    let url = initial.url
    for (let attempt = 0; attempt < 4; attempt++) {
      const upstream = await fetcher(url, { method: request.method, headers, redirect: 'manual', signal: request.signal })
      if ([301, 302, 303, 307, 308].includes(upstream.status)) {
        await upstream.body?.cancel()
        const location = upstream.headers.get('location')
        const next = location && providerMedia(new URL(location, url).href)
        if (!next || next.provider !== initial.provider) break
        url = next.url
        continue
      }
      if (upstream.status === 416) {
        await upstream.body?.cancel()
        const contentRange = upstream.headers.get('content-range')
        return new Response(null, { status: 416, headers: contentRange ? { 'content-range': contentRange } : undefined })
      }
      if (![200, 206].includes(upstream.status) || !isMediaContentType(upstream.headers)) {
        await upstream.body?.cancel()
        break
      }
      const responseHeaders = mediaResponseHeaders(upstream.headers)
      responseHeaders.set('content-type', responseHeaders.get('content-type') ?? 'application/octet-stream')
      responseHeaders.set('cache-control', 'no-store')
      responseHeaders.set('x-content-type-options', 'nosniff')
      responseHeaders.set('content-security-policy', 'sandbox')
      responseHeaders.set('cross-origin-resource-policy', 'same-origin')
      if (upstream.headers.has('content-encoding')) responseHeaders.delete('content-length')
      return new Response(upstream.body, { status: upstream.status, headers: responseHeaders })
    }
  }
  catch { /* Report a controlled error without the signed upstream URL. */ }
  return fail(502, '音频代理请求失败，请重试')
}
