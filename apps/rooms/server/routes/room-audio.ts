import { defineHandler } from 'nitro'
import { hostedMedia } from '../utils/runtime'
import { isRoomOriginAllowed } from '../utils/origin'
import { logRoomError } from '../utils/diagnostics'
import { HostedSourceError } from '../providers/shared'

export default defineHandler(async (event) => {
  const headers = new Headers({ 'cache-control': 'no-store', 'referrer-policy': 'no-referrer', vary: 'Origin' })
  const origin = event.req.headers.get('origin')
  const reject = (status: number, message: string) => {
    logRoomError('http.audio', new HostedSourceError(message), { status })
    return new Response(null, { status, headers })
  }
  if (origin) {
    if (!isRoomOriginAllowed(origin, process.env.LISTEN_ALLOWED_ORIGINS)) return reject(403, '音频请求来源不允许')
    headers.set('access-control-allow-origin', origin)
    headers.set('access-control-expose-headers', 'Content-Range, Content-Length, Accept-Ranges')
  }
  if (!['GET', 'HEAD'].includes(event.req.method)) return reject(405, '音频请求方法不支持')
  const ticket = event.url.searchParams.get('ticket') ?? ''
  if (!/^[a-f\d]{64}$/.test(ticket)) return reject(401, '音频票据格式无效')
  try {
    const response = await hostedMedia.audio(event.req, ticket)
    if ([401, 416, 429].includes(response.status)) logRoomError('http.audio', new HostedSourceError(response.status === 401 ? '音频票据已失效或撤销' : response.status === 416 ? '音频 Range 无效或超出范围' : '音频连接数超出限制'), { status: response.status })
    for (const [key, value] of headers) response.headers.set(key, value)
    return response
  }
  catch (error) {
    if (!event.req.signal.aborted) logRoomError('http.audio', error, { status: 502 })
    return new Response(null, { status: 502, headers })
  }
})
