import { normalizeClientCookie } from '@m-part/music/cookie-header'
import { providerRequest } from '@m-part/music/provider-request'
import { getRequestURL } from 'nitro/h3'

const fail = (status: number, message: string) => Response.json({ message }, { status, headers: { 'cache-control': 'no-store' } })

/** Proxy anonymous and explicitly configured sessions to fixed music API origins. */
export async function providerApiProxy(request: Request, fetcher: typeof fetch = fetch): Promise<Response> {
  if (request.method !== 'POST' || !request.headers.get('content-type')?.startsWith('application/json')) return fail(415, '请使用 JSON 请求')
  const origin = request.headers.get('origin')
  const site = request.headers.get('sec-fetch-site')
  const publicUrl = getRequestURL({ req: request }, { xForwardedHost: true, xForwardedProto: true })
  if ((site && site !== 'same-origin' && site !== 'none') || (origin && origin !== publicUrl.origin))
    return fail(403, '不允许跨站请求音源代理')
  let payload: Record<string, unknown>
  try {
    const reader = request.body?.getReader()
    if (!reader) return fail(400, '缺少请求内容')
    const chunks: Uint8Array[] = []
    let size = 0
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      size += value.byteLength
      if (size > 262_144) { await reader.cancel(); return fail(413, '请求内容过大') }
      chunks.push(value)
    }
    const bytes = new Uint8Array(size)
    let offset = 0
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length }
    payload = JSON.parse(new TextDecoder().decode(bytes))
    if (!payload || typeof payload !== 'object') return fail(400, '请求内容无效')
  }
  catch { return fail(400, '请求内容无效') }
  const target = typeof payload.url === 'string' ? providerRequest(payload.url) : undefined
  if (!target) return fail(403, '不支持的音源接口地址')
  if (payload.method !== 'GET' && payload.method !== 'POST') return fail(405, '不支持的请求方法')
  let cookie: string
  try { cookie = typeof payload.cookie === 'string' ? normalizeClientCookie(payload.cookie) : '' }
  catch { return fail(400, 'Cookie 格式无效') }
  const headers = new Headers({ origin: target.cookie.requestOrigin, referer: `${target.cookie.requestOrigin}/` })
  if (cookie) headers.set('cookie', cookie)
  try {
    if (payload.headers && typeof payload.headers === 'object') {
      for (const [key, value] of Object.entries(payload.headers)) {
        if (['accept', 'accept-language', 'content-type', 'user-agent'].includes(key.toLowerCase()) && typeof value === 'string') headers.set(key, value)
      }
    }
    const upstream = await fetcher(target.url, {
      method: payload.method, headers, redirect: 'error', signal: AbortSignal.any([request.signal, AbortSignal.timeout(20_000)]),
      body: payload.method === 'POST' && typeof payload.body === 'string' ? payload.body : undefined,
    })
    return new Response(upstream.body, { status: upstream.status, headers: {
      'content-type': 'application/json',
      'x-content-type-options': 'nosniff',
      'cache-control': 'no-store',
    } })
  }
  catch { return fail(502, '音源接口请求失败，请稍后重试') }
}
