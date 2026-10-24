import * as v from 'valibot'
import { defineWebSocketHandler } from 'nitro'
import { LISTEN_PROTOCOL, clientMessage } from '@m-part/listen-core/protocol'
import { rooms } from '../utils/runtime'
import { isRoomOriginAllowed } from '../utils/origin'
import { logRoomError } from '../utils/diagnostics'
import { HostedSourceError } from '../providers/shared'

const clients = new Map<string, { authenticated: boolean, openedAt: number, lastMessage: number, count: number, attempts: number, bytes: number, budgetAt: number, close: () => void }>()
const upgrades = new Map<string, { at: number, count: number }>()
// Lazy maintenance avoids an import-time interval during Nitro's build scans.
let timer: ReturnType<typeof setInterval> | undefined

export default defineWebSocketHandler({
  upgrade(request) {
    const reject = (status: number, reason: string) => {
      logRoomError('ws.upgrade', new HostedSourceError(reason), { status })
      return new Response(reason, { status })
    }
    const origin = request.headers.get('origin')
    if (!origin || !isRoomOriginAllowed(request.url, origin, process.env.LISTEN_ALLOWED_ORIGINS)) throw reject(403, 'Origin rejected')
    const now = performance.now()
    for (const [key, entry] of upgrades) if (now - entry.at >= 60_000) upgrades.delete(key)
    if (upgrades.size >= 200 && !upgrades.has(origin)) throw reject(429, 'Too many origins')
    const budget = upgrades.get(origin) ?? { at: now, count: 0 }
    if (++budget.count > 60) throw reject(429, 'Too many connections')
    upgrades.set(origin, budget)
    if (clients.size >= 200) throw reject(503, 'Capacity reached')
  },
  open(peer) {
    clients.set(peer.id, { authenticated: false, openedAt: performance.now(), lastMessage: performance.now(), count: 0, attempts: 0, bytes: 0, budgetAt: performance.now(), close: () => peer.close() })
    timer ??= setInterval(() => {
      rooms.sweep()
      for (const client of clients.values()) if (!client.authenticated && performance.now() - client.openedAt > 5_000) client.close()
      if (!clients.size && !rooms.hasRooms && timer) { clearInterval(timer); timer = undefined }
    }, 1_000)
    timer.unref()
  },
  message(peer, message) {
    const client = clients.get(peer.id)
    if (!client) return
    if (performance.now() - client.lastMessage >= 1_000) { client.count = 0; client.lastMessage = performance.now() }
    if (performance.now() - client.budgetAt >= 5_000) { client.bytes = 0; client.budgetAt = performance.now() }
    const length = message.text().length
    client.bytes += length
    if (++client.count > 30 || length > 1_000_000 || client.bytes > 1_500_000 || (!client.authenticated && ++client.attempts > 5)) { logRoomError('ws.message', new HostedSourceError('消息超出大小或频率限制')); peer.close(1008, 'Message limit'); return }
    let parsed
    let payload: unknown
    try { payload = message.json(); parsed = v.safeParse(clientMessage, payload) }
    catch { logRoomError('ws.message', new HostedSourceError('消息 JSON 无效')); peer.close(1008, 'Invalid JSON'); return }
    if (!parsed.success) {
      logRoomError('ws.message', new HostedSourceError('消息格式或协议版本无效'))
      if (payload && typeof payload === 'object' && 'protocol' in payload && payload.protocol !== LISTEN_PROTOCOL) peer.send(JSON.stringify({ type: 'error', code: 'protocol', message: '一起听协议已升级，请同时更新客户端与房间服务' }))
      peer.close(1008, 'Invalid message'); return
    }
    rooms.receive({
      id: peer.id,
      send(reply) {
        if (reply.type === 'welcome') client.authenticated = true
        if (reply.type === 'error') logRoomError(`ws.${reply.code}`, new HostedSourceError(reply.message))
        peer.send(JSON.stringify(reply))
      },
      close: () => peer.close(),
    }, parsed.output)
  },
  close(peer) {
    clients.delete(peer.id)
    rooms.disconnect(peer.id)
    // Disconnected rooms still need expiry sweeps to clear private hosted sessions.
    if (!clients.size && !rooms.hasRooms && timer) { clearInterval(timer); timer = undefined }
  },
  error(peer, error) { logRoomError('ws.connection', error); rooms.disconnect(peer.id) },
})
