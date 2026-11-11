import { createQQHostedProvider } from '../providers/qq'
import { createBiliHostedProvider } from '../providers/bilibili'
import { createNeteaseHostedProvider } from '../providers/netease'
import { ListenRooms } from './listen-rooms'
import { HostedMedia } from './hosted-media'
import { openRoomStorage } from './room-storage'

export function verifyRoomAccount(proof: string) {
  const config = readListenAccountConfig(process.env)
  if (config) return verifyListenAccount(config, proof)
}

let storage: ReturnType<typeof openRoomStorage> | undefined
export const rooms = new ListenRooms(undefined, state => hostedMedia.sync(state), undefined, {
  verify: verifyRoomAccount,
  storage() {
    if (!readListenAccountConfig(process.env)) return
    const path = process.env.LISTEN_ROOM_DB_PATH
    if (!path || path === ':memory:') throw new Error('未配置长期房间的 SQLite 文件')
    return storage ??= openRoomStorage(path)
  },
})
export const hostedMedia = new HostedMedia(rooms, { netease: createNeteaseHostedProvider(), qq: createQQHostedProvider(), bili: createBiliHostedProvider() })
import { readListenAccountConfig, verifyListenAccount } from '@m-part/listen-core/account-proof'
