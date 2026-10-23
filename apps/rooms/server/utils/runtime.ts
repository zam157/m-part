import { createQQHostedProvider } from '../providers/qq'
import { createBiliHostedProvider } from '../providers/bilibili'
import { createNeteaseHostedProvider } from '../providers/netease'
import { ListenRooms } from './listen-rooms'
import { HostedMedia } from './hosted-media'

export const rooms = new ListenRooms(undefined, state => hostedMedia.sync(state))
export const hostedMedia = new HostedMedia(rooms, { netease: createNeteaseHostedProvider(), qq: createQQHostedProvider(), bili: createBiliHostedProvider() })
