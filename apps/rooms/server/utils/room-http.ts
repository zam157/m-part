import * as v from 'valibot'
import { roomControl } from '@m-part/listen-core/protocol'
import { HostedSourceError } from '../providers/shared'
import type { HostedMedia } from './hosted-media'
import { isRoomOriginAllowed } from './origin'
import { logRoomError } from './diagnostics'

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
export function createRoomControlHandler(media: HostedMedia, options: { allowedOrigins?: () => string | undefined } = {}) {
  let active = 0
  const budgets = new Map<string, { at: number, count: number }>()
  return async (request: Request) => {
    const origin = request.headers.get('origin') ?? ''
    const headers = new Headers({ 'cache-control': 'no-store', 'referrer-policy': 'no-referrer', vary: 'Origin' })
    const reject = (status: number, message: string, body = true) => {
      logRoomError('http.control', new HostedSourceError(message), { status })
      return body ? Response.json({ error: message }, { status, headers }) : new Response(null, { status, headers })
    }
    if (!isRoomOriginAllowed(origin, options.allowedOrigins?.())) return reject(403, '请求来源不允许', false)
    if (origin) headers.set('access-control-allow-origin', origin)
    headers.set('access-control-allow-methods', 'POST, OPTIONS')
    headers.set('access-control-allow-headers', 'authorization, content-type')
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers })
    const json = (value: unknown, status = 200) => Response.json(value, { status, headers })
    if (request.method !== 'POST') return reject(405, '请求方法不支持', false)
    const token = /^Bearer ([a-f\d]{64})$/.exec(request.headers.get('authorization') ?? '')?.[1]
    if (!token) return reject(401, '房间成员身份无效，请重新连接')
    const now = performance.now()
    for (const [key, entry] of budgets) if (now - entry.at >= 60_000) budgets.delete(key)
    const budget = budgets.get(origin) ?? { at: now, count: 0 }
    if (++budget.count > 300 || active >= 40 || budgets.size > 200) return reject(429, '房间操作过于频繁，请稍后重试')
    budgets.set(origin, budget)
    active++
    let action: string | undefined
    try {
      const control = await readControl(request)
      action = control.action
      return json(await media.control(token, control, request.signal))
    }
    catch (error) {
      if (!request.signal.aborted) logRoomError(action ? `http.control.${action}` : 'http.control', error, { status: 400 })
      return json({ error: error instanceof HostedSourceError ? error.message : '房间操作未完成，请检查连接、权限和状态后重试' }, 400)
    }
    finally { active-- }
  }
}
