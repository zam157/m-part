import type { RoomControl } from '@m-part/listen-core/protocol'
import { tRequest } from '@m-part/music/fetch'

/** Room bearer authentication never uses a music cookie or fetch credentials. */
export async function sendRoomControl(server: string, token: string, control: RoomControl, signal?: AbortSignal): Promise<unknown> {
  const result = await tRequest<unknown>(`${server}/room-control`, {
    method: 'POST', credentials: 'omit', acceptHttpErrors: true, signal,
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' }, body: control,
  })
  if (!result[0]) throw new Error('房间音源操作失败，请检查服务器连接')
  const data = result[1]
  if (data && typeof data === 'object' && 'error' in data) {
    const message = typeof data.error === 'string' ? data.error.slice(0, 300).replace(/https?:\/\/\S+/g, '[服务地址]') : '房间音源操作失败'
    throw new Error(message)
  }
  return data
}
