import { hostedPlatform } from '@m-part/listen-core/protocol'
import type { HostedPlatform } from '@m-part/listen-core/protocol'
import { getCookieProviders } from '@m-part/music/provider-definitions'
import { getClientSessionCookie } from '@m-part/music/client-cookies'
import type { RoomCredentials } from './listen-client'

export const roomCredentialProviders = getCookieProviders().filter((item): item is typeof item & { name: HostedPlatform } => !!item.cookie.session && hostedPlatform.options.some(name => name === item.name))
export const currentRoomCredentials: RoomCredentials = { platforms: roomCredentialProviders.map(item => item.name), read: getClientSessionCookie }
