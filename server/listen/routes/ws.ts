import * as v from 'valibot'
import { defineWebSocketHandler } from 'nitro'
import { clientMessage } from '../../../shared/types/listen-room'
import { ListenRooms } from '../../utils/listen-rooms'

const rooms = new ListenRooms()
const clients = new Map<string, { authenticated: boolean, openedAt: number, lastMessage: number, count: number, close: () => void }>()
// Lazy maintenance avoids an import-time interval during Nitro's build scans.
let timer: ReturnType<typeof setInterval> | undefined

export default defineWebSocketHandler({
  upgrade(request) {
    const origin = request.headers.get('origin')
    const url = new URL(request.url)
    const localOrigin = ['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname) ? [url.origin] : []
    const allowed = process.env.LISTEN_ALLOWED_ORIGINS?.split(',').map(s => s.trim()) ?? localOrigin
    if (!origin || !allowed.includes(origin)) throw new Response('Origin rejected', { status: 403 })
    if (clients.size >= 200) throw new Response('Capacity reached', { status: 503 })
  },
  open(peer) {
    clients.set(peer.id, { authenticated: false, openedAt: performance.now(), lastMessage: performance.now(), count: 0, close: () => peer.close() })
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
    if (++client.count > 30 || message.text().length > 4_096) { peer.close(1008, 'Message limit'); return }
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
