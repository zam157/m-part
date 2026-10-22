import * as v from 'valibot'
import { defineWebSocketHandler } from 'nitro'
import { clientMessage } from '../../../shared/types/listen-room'
import { ListenRooms } from '../../utils/listen-rooms'

const rooms = new ListenRooms()
const clients = new Map<string, { authenticated: boolean, openedAt: number, lastMessage: number, count: number, attempts: number, bytes: number, budgetAt: number, close: () => void }>()
const upgrades = new Map<string, { at: number, count: number }>()
// Lazy maintenance avoids an import-time interval during Nitro's build scans.
let timer: ReturnType<typeof setInterval> | undefined

export default defineWebSocketHandler({
  upgrade(request) {
    const origin = request.headers.get('origin')
    const url = new URL(request.url)
    const local = ['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname)
    const localOrigin = local ? [url.origin, ...(/^chrome-extension:\/\/[a-p]{32}$/.test(origin ?? '') ? [origin!] : [])] : []
    const allowed = process.env.LISTEN_ALLOWED_ORIGINS?.split(',').map(s => s.trim()) ?? localOrigin
    if (!origin || !allowed.includes(origin)) throw new Response('Origin rejected', { status: 403 })
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
    try { parsed = v.safeParse(clientMessage, message.json()) }
    catch { peer.close(1008, 'Invalid JSON'); return }
    if (!parsed.success) { peer.close(1008, 'Invalid message'); return }
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
    if (!clients.size && timer) { clearInterval(timer); timer = undefined }
  },
  error(peer) { rooms.disconnect(peer.id) },
})
