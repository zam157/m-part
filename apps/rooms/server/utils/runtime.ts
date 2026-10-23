import { createNeteaseHostedProvider } from '../providers/netease'
import { ListenRooms } from './listen-rooms'
import { HostedMedia } from './hosted-media'

export const rooms = new ListenRooms(undefined, state => hostedMedia.sync(state))
export const hostedMedia = new HostedMedia(rooms, createNeteaseHostedProvider())
