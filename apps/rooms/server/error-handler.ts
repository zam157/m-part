import { logRoomError } from './utils/diagnostics'

/** Do not serialize request URLs, bearer tokens, upstream errors or credential bodies. */
export default function roomErrorHandler(error: unknown) {
  const value = error && typeof error === 'object' && 'status' in error ? error.status : 500
  const status = typeof value === 'number' && Number.isInteger(value) && value >= 400 && value <= 599 ? value : 500
  logRoomError('http.unhandled', error, { status })
  return Response.json({ error: status === 404 ? '接口不存在' : '房间服务请求失败' }, { status, headers: { 'cache-control': 'no-store', 'referrer-policy': 'no-referrer' } })
}
