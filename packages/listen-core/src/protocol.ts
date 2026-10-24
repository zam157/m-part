import * as v from 'valibot'

/** Only public track metadata crosses the wire; source URLs and cookies never do. */
export const LISTEN_PROTOCOL = 5
export const LAB_TRACK = { id: 'calibration-v1', duration: 90 } as const
export const HEARTBEAT_MS = 5_000
export const CONNECTION_TIMEOUT_MS = 12_000
export const DISCONNECT_GRACE_MS = 20_000
export const START_LEAD_MS = 800

const shortText = v.pipe(v.string(), v.minLength(1), v.maxLength(80))
const revision = v.pipe(v.number(), v.integer(), v.minValue(0))
const position = v.pipe(v.number(), v.finite(), v.minValue(0), v.maxValue(86_400))
const text = v.pipe(v.string(), v.maxLength(300), v.transform(s => s.replace(/<[^>]*>/g, '').replace(/[<>]/g, '')))
const track = v.strictObject({
  provider: v.picklist(['netease', 'qq', 'bili']), id: v.pipe(v.string(), v.minLength(1), v.maxLength(128)),
  title: text, artist: v.optional(text), album: v.optional(text), duration: position,
  coverUrl: v.pipe(v.string(), v.maxLength(2048), v.check(s => !s || /^https:\/\//i.test(s))),
})
export type SharedRoomTrack = v.InferOutput<typeof track> & { queueItemId: string }
const tracks = v.pipe(v.array(track), v.maxLength(1_000))
const mode = v.picklist(['order', 'loop', 'random', 'single-loop'])
export const memberStatus = v.picklist(['loading', 'ready', 'following', 'buffering', 'away', 'blocked', 'failed'])
export type MemberStatus = v.InferOutput<typeof memberStatus>

export const clientMessage = v.variant('type', [
  v.strictObject({ type: v.literal('create'), protocol: v.literal(LISTEN_PROTOCOL), name: shortText,
    kind: v.optional(v.literal('music')), tracks: v.optional(tracks), index: v.optional(revision), position: v.optional(position), autoplay: v.optional(v.boolean()),
  }),
  v.strictObject({ type: v.literal('join'), protocol: v.literal(LISTEN_PROTOCOL), name: shortText, code: shortText, kind: v.optional(v.literal('music')) }),
  v.strictObject({ type: v.literal('resume'), protocol: v.literal(LISTEN_PROTOCOL), token: v.pipe(v.string(), v.maxLength(128)) }),
  v.strictObject({ type: v.literal('ping'), sentAt: v.pipe(v.number(), v.finite(), v.minValue(0)) }),
  v.strictObject({
    type: v.literal('command'), commandId: shortText, expectedRevision: revision,
    action: v.picklist(['play', 'pause', 'seek', 'restart', 'queue', 'select', 'append', 'add-next', 'remove', 'mode', 'next', 'previous', 'ended']),
    position: v.optional(position), tracks: v.optional(tracks), track: v.optional(track), queueItemId: v.optional(shortText), mode: v.optional(mode),
  }),
  v.strictObject({ type: v.literal('role'), commandId: shortText, memberId: shortText, role: v.picklist(['admin', 'member']) }),
  v.strictObject({ type: v.literal('chat'), commandId: shortText, text: v.pipe(v.string(), v.maxLength(500), v.transform(s => s.replace(/[\x00-\x08\x0b-\x1f\x7f]/g, '').trim()), v.minLength(1)) }),
  v.strictObject({ type: v.literal('report'), revision, playbackId: shortText, status: memberStatus, message: v.optional(v.pipe(v.string(), v.maxLength(300))), duration: v.optional(position) }),
  v.strictObject({ type: v.literal('leave') }),
])
export type ClientMessage = v.InferOutput<typeof clientMessage>

export const hostedPlatform = v.picklist(['netease', 'qq', 'bili'])
export type HostedPlatform = v.InferOutput<typeof hostedPlatform>
const roomAccount = v.strictObject({
  credential: v.picklist(['none', 'ready', 'invalid']), version: revision,
  ownerId: v.optional(shortText), label: v.optional(text),
})
export type RoomAccount = v.InferOutput<typeof roomAccount>

export const roomSource = v.strictObject({
  mode: v.picklist(['independent', 'hosted']), version: revision,
  provider: v.optional(hostedPlatform),
  credential: v.picklist(['none', 'ready', 'invalid']),
  ownerId: v.optional(shortText), label: v.optional(text), error: v.optional(text),
  accounts: v.optional(v.partial(v.strictObject({ netease: roomAccount, qq: roomAccount, bili: roomAccount }))),
})
export type RoomSource = v.InferOutput<typeof roomSource>

/** Current-track status is derived from its platform; accounts never select a track. */
export function currentRoomSource(source: RoomSource, provider?: HostedPlatform): RoomSource {
  const account = provider ? source.accounts?.[provider] : undefined
  return { ...source, provider, credential: account?.credential ?? 'none', label: account?.label, ownerId: account?.ownerId }
}

/** Credentials only travel in authenticated HTTP requests, never in room messages. */
const roomRequest = { roomId: shortText }
const roomMutation = { ...roomRequest, expectedRevision: revision }
export const roomControl = v.variant('action', [
  v.strictObject({ ...roomMutation, action: v.literal('credential'), provider: v.optional(hostedPlatform), cookie: v.pipe(v.string(), v.minLength(1), v.maxLength(4096)) }),
  v.strictObject({ ...roomMutation, action: v.literal('source'), mode: v.picklist(['independent', 'hosted']) }),
  v.strictObject({ ...roomMutation, action: v.literal('revoke'), provider: hostedPlatform }),
  v.strictObject({ ...roomMutation, action: v.literal('retry-source') }),
  v.strictObject({ ...roomRequest, action: v.literal('ticket'), queueItemId: shortText, playbackId: shortText, sourceVersion: revision }),
  v.strictObject({ ...roomRequest, action: v.literal('renew'), ticket: v.pipe(v.string(), v.minLength(32), v.maxLength(80)) }),
])
export type RoomControl = v.InferOutput<typeof roomControl>
export const roomTicket = v.strictObject({ ticket: v.pipe(v.string(), v.minLength(32), v.maxLength(80)), leaseMs: v.pipe(v.number(), v.minValue(1000), v.maxValue(300_000)) })
export type RoomTicket = v.InferOutput<typeof roomTicket>

export const ROOM_HISTORY_LIMIT = 200
const historyEntry = v.strictObject({
  id: revision, at: v.pipe(v.number(), v.integer(), v.minValue(0), v.maxValue(8_640_000_000_000_000)), kind: v.picklist(['chat', 'operation']),
  memberId: v.optional(shortText), name: v.optional(shortText), text: v.pipe(v.string(), v.maxLength(500)),
})
export type RoomHistoryEntry = v.InferOutput<typeof historyEntry>

export interface RoomSnapshot {
  protocol: typeof LISTEN_PROTOCOL
  roomId: string
  code: string
  revision: number
  playbackId: string
  kind: 'lab' | 'music'
  queue: SharedRoomTrack[]
  currentIndex: number | null
  playMode: v.InferOutput<typeof mode>
  source?: RoomSource
  track: { id: string, duration: number }
  status: 'preparing' | 'scheduled' | 'playing' | 'paused' | 'ended'
  wantsToPlay: boolean
  pauseReason: 'user' | 'host-buffering' | 'blocked' | 'failed' | 'host-disconnected' | null
  positionAtAnchor: number
  anchorServerTime: number
  rate: 1
  hostId: string
  activityVersion: number
  history: RoomHistoryEntry[]
  members: { role: 'host' | 'admin' | 'member', id: string, name: string, generation: number, online: boolean, status: MemberStatus, message?: string }[]
}

export type ServerMessage =
  | { type: 'welcome', token: string, memberId: string, generation: number, snapshot: RoomSnapshot }
  | { type: 'snapshot', snapshot: RoomSnapshot }
  | { type: 'pong', sentAt: number, serverTime: number }
  | { type: 'ack', commandId: string, revision: number }
  | { type: 'error', code: string, message: string, commandId?: string }
  | { type: 'replaced' }

const clockTime = v.pipe(v.number(), v.finite(), v.minValue(0))
const snapshot = v.strictObject({
  protocol: v.literal(LISTEN_PROTOCOL), roomId: shortText, code: shortText, revision, playbackId: shortText,
  kind: v.picklist(['lab', 'music']), queue: v.pipe(v.array(v.strictObject({ ...track.entries, queueItemId: shortText })), v.maxLength(1_000)),
  currentIndex: v.nullable(revision), playMode: mode, source: v.optional(roomSource),
  track: v.strictObject({ id: v.pipe(v.string(), v.maxLength(80)), duration: position }),
  status: v.picklist(['preparing', 'scheduled', 'playing', 'paused', 'ended']), wantsToPlay: v.boolean(),
  pauseReason: v.nullable(v.picklist(['user', 'host-buffering', 'blocked', 'failed', 'host-disconnected'])),
  positionAtAnchor: position, anchorServerTime: clockTime, rate: v.literal(1), hostId: shortText,
  activityVersion: revision, history: v.pipe(v.array(historyEntry), v.maxLength(ROOM_HISTORY_LIMIT)),
  members: v.pipe(v.array(v.strictObject({ role: v.picklist(['host', 'admin', 'member']), id: shortText, name: shortText, generation: revision, online: v.boolean(), status: memberStatus, message: v.optional(text) })), v.maxLength(5)),
})
export { snapshot as roomSnapshot }
export const serverMessage = v.variant('type', [
  v.strictObject({ type: v.literal('welcome'), token: v.pipe(v.string(), v.minLength(1), v.maxLength(128)), memberId: shortText, generation: revision, snapshot }),
  v.strictObject({ type: v.literal('snapshot'), snapshot }),
  v.strictObject({ type: v.literal('pong'), sentAt: clockTime, serverTime: clockTime }),
  v.strictObject({ type: v.literal('ack'), commandId: shortText, revision }),
  v.strictObject({ type: v.literal('error'), code: shortText, message: text, commandId: v.optional(shortText) }),
  v.strictObject({ type: v.literal('replaced') }),
])
