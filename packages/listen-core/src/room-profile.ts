import * as v from 'valibot'
import { normalizeRoomServer } from './room-server'

const label = v.pipe(v.string(), v.trim(), v.minLength(1), v.maxLength(80))
const nickname = v.pipe(v.string(), v.trim(), v.minLength(1), v.maxLength(80))
const serverUrl = v.pipe(v.string(), v.trim(), v.minLength(1), v.maxLength(2048), v.check((value) => {
  try { normalizeRoomServer(value); return true }
  catch { return false }
}, '请输入有效的房间服务器地址'), v.transform(normalizeRoomServer))
export const roomProfileInput = v.strictObject({ label, serverUrl, nickname })
export const roomProfileRevision = v.pipe(v.number(), v.integer(), v.minValue(1), v.maxValue(2_147_483_646))
export const roomProfileUpdate = v.strictObject({ ...roomProfileInput.entries, revision: roomProfileRevision })
export type RoomProfileInput = v.InferOutput<typeof roomProfileInput>
export type RoomProfile = RoomProfileInput & { id: string, revision: number }
