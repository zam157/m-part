import { defineHandler } from 'nitro'
import { rooms, verifyRoomAccount } from '../utils/runtime'
import { isRoomOriginAllowed } from '../utils/origin'
import { logRoomError } from '../utils/diagnostics'

export default defineHandler(({ req }) => {
  const origin = req.headers.get('origin')
  const headers = new Headers({ 'cache-control': 'no-store', vary: 'Origin' })
  if (!isRoomOriginAllowed(origin, process.env.LISTEN_ALLOWED_ORIGINS)) return new Response(null, { status: 403, headers })
  if (origin) headers.set('access-control-allow-origin', origin)
  headers.set('access-control-allow-methods', 'GET, OPTIONS')
  headers.set('access-control-allow-headers', 'authorization')
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers })
  if (req.method !== 'GET') return new Response(null, { status: 405, headers })
  try {
    const proof = req.headers.get('authorization')?.match(/^Bearer (\S+)$/)?.[1]
    const account = proof && verifyRoomAccount(proof)
    if (!account) return new Response(null, { status: 401, headers })
    return Response.json(rooms.roomsForAccount(account.id), { headers })
  }
  catch (error) {
    logRoomError('http.account-rooms', error, { status: 503 })
    return new Response(null, { status: 503, headers })
  }
})
