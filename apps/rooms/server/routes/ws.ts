import * as v from 'valibot'
import { defineWebSocketHandler } from 'nitro'
import { LISTEN_PROTOCOL, clientMessage } from '@m-part/listen-core/protocol'
import { rooms } from '../utils/runtime'
import { isRoomOriginAllowed } from '../utils/origin'

const clients = new Map<string, { authenticated: boolean, openedAt: number, lastMessage: number, count: number, attempts: number, bytes: number, budgetAt: number, close: () => void }>()
const upgrades = new Map<string, { at: number, count: number }>()
// Lazy maintenance avoids an import-time interval during Nitro's build scans.
let timer: ReturnType<typeof setInterval> | undefined

export default defineWebSocketHandler({
  upgrade(request) {
    const origin = request.headers.get('origin')
    if (!origin || !isRoomOriginAllowed(request.url, origin, process.env.LISTEN_ALLOWED_ORIGINS)) throw new Response('Origin rejected', { status: 403 })
    const now = performance.now()
    for (const [key, entry] of upgrades) if (now - entry.at >= 60_000) upgrades.delete(key)
    if (upgrades.size >= 200 && !upgrades.has(origin)) throw new Response('Too many origins', { status: 429 })
    const budget = upgrades.get(origin) ?? { at: now, count: 0 }
    if (++budget.count > 60) throw new Response('Too many connections', { status: 429 })
    upgrades.set(origin, budget)
    if (clients.size >= 200) throw new Response('Capacity reached', { status: 503 })
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
    if (++client.count > 30 || length > 1_000_000 || client.bytes > 1_500_000 || (!client.authenticated && ++client.attempts > 5)) { peer.close(1008, 'Message limit'); return }
    let parsed
    let payload: unknown
    try { payload = message.json(); parsed = v.safeParse(clientMessage, payload) }
    catch { peer.close(1008, 'Invalid JSON'); return }
    if (!parsed.success) {
      if (payload && typeof payload === 'object' && 'protocol' in payload && payload.protocol !== LISTEN_PROTOCOL) peer.send(JSON.stringify({ type: 'error', code: 'protocol', message: '一起听协议已升级，请同时更新客户端与房间服务' }))
      peer.close(1008, 'Invalid message'); return
    }
    rooms.receive({
      id: peer.id,
      send(reply) {
        if (reply.type === 'welcome') client.authenticated = true
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
  error(peer) { rooms.disconnect(peer.id) },
})
