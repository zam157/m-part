import * as v from 'valibot'

/** Phase-one protocol: one generated calibration track, no third-party credentials. */
export const LISTEN_PROTOCOL = 1
export const LAB_TRACK = { id: 'calibration-v1', duration: 90 } as const
export const HEARTBEAT_MS = 5_000
export const CONNECTION_TIMEOUT_MS = 12_000
export const DISCONNECT_GRACE_MS = 20_000
export const START_LEAD_MS = 800

const shortText = v.pipe(v.string(), v.minLength(1), v.maxLength(80))
const revision = v.pipe(v.number(), v.integer(), v.minValue(0))
const position = v.pipe(v.number(), v.finite(), v.minValue(0), v.maxValue(LAB_TRACK.duration))
export const memberStatus = v.picklist(['loading', 'ready', 'following', 'buffering', 'away', 'blocked', 'failed'])
export type MemberStatus = v.InferOutput<typeof memberStatus>

export const clientMessage = v.variant('type', [
  v.strictObject({ type: v.literal('create'), protocol: v.literal(LISTEN_PROTOCOL), name: shortText }),
  v.strictObject({ type: v.literal('join'), protocol: v.literal(LISTEN_PROTOCOL), name: shortText, code: shortText }),
  v.strictObject({ type: v.literal('resume'), protocol: v.literal(LISTEN_PROTOCOL), token: v.pipe(v.string(), v.maxLength(128)) }),
  v.strictObject({ type: v.literal('ping'), sentAt: v.pipe(v.number(), v.finite(), v.minValue(0)) }),
  v.strictObject({
    type: v.literal('command'), commandId: shortText, expectedRevision: revision,
    action: v.picklist(['play', 'pause', 'seek', 'restart']), position: v.optional(position),
  }),
  v.strictObject({ type: v.literal('report'), revision, playbackId: shortText, status: memberStatus }),
  v.strictObject({ type: v.literal('leave') }),
])
export type ClientMessage = v.InferOutput<typeof clientMessage>

export interface RoomSnapshot {
  protocol: typeof LISTEN_PROTOCOL
  roomId: string
  code: string
  revision: number
  playbackId: string
  track: typeof LAB_TRACK
  status: 'preparing' | 'scheduled' | 'playing' | 'paused' | 'ended'
  wantsToPlay: boolean
  pauseReason: 'user' | 'host-buffering' | 'blocked' | 'failed' | 'host-disconnected' | null
  positionAtAnchor: number
  anchorServerTime: number
  rate: 1
  hostId: string
  members: { id: string, name: string, generation: number, online: boolean, status: MemberStatus }[]
}

export type ServerMessage =
  | { type: 'welcome', token: string, memberId: string, generation: number, snapshot: RoomSnapshot }
  | { type: 'snapshot', snapshot: RoomSnapshot }
  | { type: 'pong', sentAt: number, serverTime: number }
  | { type: 'ack', commandId: string, revision: number }
  | { type: 'error', code: string, message: string, commandId?: string }
  | { type: 'replaced' }
