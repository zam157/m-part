import { defineHandler } from 'nitro'
import { hostedMedia } from '../utils/runtime'
import { isRoomOriginAllowed } from '../utils/origin'

export default defineHandler(async (event) => {
  const headers = new Headers({ 'cache-control': 'no-store', 'referrer-policy': 'no-referrer', vary: 'Origin' })
  const origin = event.req.headers.get('origin')
  if (origin) {
    if (!isRoomOriginAllowed(event.req.url, origin, process.env.LISTEN_ALLOWED_ORIGINS)) return new Response(null, { status: 403, headers })
    headers.set('access-control-allow-origin', origin)
    headers.set('access-control-expose-headers', 'Content-Range, Content-Length, Accept-Ranges')
  }
  if (!['GET', 'HEAD'].includes(event.req.method)) return new Response(null, { status: 405, headers })
  if (process.env.LISTEN_HOSTED_ENABLED !== '1') return new Response(null, { status: 503, headers })
  const ticket = event.url.searchParams.get('ticket') ?? ''
  if (!/^[a-f\d]{64}$/.test(ticket)) return new Response(null, { status: 401, headers })
  try {
    const response = await hostedMedia.audio(event.req, ticket)
    for (const [key, value] of headers) response.headers.set(key, value)
    return response
  }
  catch { return new Response(null, { status: 502, headers }) }
})
