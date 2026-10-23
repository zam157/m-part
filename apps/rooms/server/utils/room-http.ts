import * as v from 'valibot'
import { roomControl } from '@m-part/listen-core/protocol'
import { HostedSourceError } from '../providers/shared'
import type { HostedMedia } from './hosted-media'
import { isRoomOriginAllowed } from './origin'

export function credentialTransportAllowed(server: string, publicOrigin?: string) {
  const url = new URL(server)
  if (url.protocol === 'https:' || ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)) return true
  if (!publicOrigin) return false
  const configured = new URL(publicOrigin)
  return configured.protocol === 'https:' && configured.origin === publicOrigin
}

async function readControl(request: Request) {
  const reader = request.body?.getReader()
  if (!reader) throw new HostedSourceError('缺少房间操作内容')
  const chunks: Uint8Array[] = []
  let bytes = 0
  const timer = setTimeout(() => { void reader.cancel().catch(() => {}) }, 5_000)
  try {
    while (true) {
      const value = await reader.read()
      if (value.done) break
      bytes += value.value.byteLength
      if (bytes > 8192) throw new HostedSourceError('房间操作内容过大')
      chunks.push(value.value)
    }
    return v.parse(roomControl, JSON.parse(Buffer.concat(chunks).toString()))
  }
  catch { await reader.cancel().catch(() => {}); throw new HostedSourceError('房间操作内容无效或过大') }
  finally { clearTimeout(timer) }
}

/** No request bodies, bearer tokens, tickets, cookies or upstream URLs are logged. */
export function createRoomControlHandler(media: HostedMedia, options: { enabled: () => boolean, publicOrigin?: () => string | undefined, allowedOrigins?: () => string | undefined }) {
  let active = 0
  const budgets = new Map<string, { at: number, count: number }>()
  return async (request: Request) => {
    const origin = request.headers.get('origin') ?? undefined
    const headers = new Headers({ 'cache-control': 'no-store', 'referrer-policy': 'no-referrer', vary: 'Origin' })
    if (!origin || !isRoomOriginAllowed(request.url, origin, options.allowedOrigins?.())) return new Response(null, { status: 403, headers })
    headers.set('access-control-allow-origin', origin)
    headers.set('access-control-allow-methods', 'POST, OPTIONS')
    headers.set('access-control-allow-headers', 'authorization, content-type')
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers })
    const json = (value: unknown, status = 200) => Response.json(value, { status, headers })
    if (!options.enabled()) return json({ error: '服务器尚未启用房间托管音源' }, 503)
    if (request.method !== 'POST') return new Response(null, { status: 405, headers })
    const token = /^Bearer ([a-f\d]{64})$/.exec(request.headers.get('authorization') ?? '')?.[1]
    if (!token) return json({ error: '房间成员身份无效，请重新连接' }, 401)
    const now = performance.now()
    for (const [key, entry] of budgets) if (now - entry.at >= 60_000) budgets.delete(key)
    const budget = budgets.get(origin) ?? { at: now, count: 0 }
    if (++budget.count > 300 || active >= 40 || budgets.size > 200) return json({ error: '房间操作过于频繁，请稍后重试' }, 429)
    budgets.set(origin, budget)
    active++
    try {
      const control = await readControl(request)
      if (control.action === 'credential' && !credentialTransportAllowed(request.url, options.publicOrigin?.())) return json({ error: '绑定房间账号需要 HTTPS；本机回环地址可用 HTTP 调试' }, 400)
      return json(await media.control(token, control, request.signal))
    }
    catch (error) { return json({ error: error instanceof HostedSourceError ? error.message : '房间操作未完成，请检查连接、权限和状态后重试' }, 400) }
    finally { active-- }
  }
}
