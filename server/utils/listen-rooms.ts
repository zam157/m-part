import type { ClientMessage, MemberStatus, RoomSnapshot, ServerMessage } from '../../shared/types/listen-room'
import { randomBytes, randomUUID } from 'node:crypto'
import { CONNECTION_TIMEOUT_MS, DISCONNECT_GRACE_MS, LAB_TRACK, LISTEN_PROTOCOL, START_LEAD_MS } from '../../shared/types/listen-room'
import { roomPosition } from '../../shared/utils/listen-clock'

export interface RoomConnection {
  id: string
  send: (message: ServerMessage) => void
  close: () => void
}
interface Member {
  id: string
  name: string
  token: string
  generation: number
  status: MemberStatus
  connection?: RoomConnection
  lastSeen: number
  disconnectedAt?: number
  replies: Map<string, { at: number, reply: ServerMessage }>
}
interface Room { state: RoomSnapshot, members: Member[], createdAt: number }

/** Owns ordering; injectable time makes disconnect and recovery races testable. */
export class ListenRooms {
  private rooms = new Map<string, Room>()
  private bindings = new Map<string, { room: Room, member: Member }>()
  private tokens = new Map<string, { room: Room, member: Member }>()

  constructor(private now = () => performance.now()) {}

  private snapshot(room: Room): RoomSnapshot {
    return {
      ...room.state,
      track: { ...LAB_TRACK },
      members: room.members.map(m => ({ id: m.id, name: m.name, generation: m.generation, online: !!m.connection, status: m.status })),
    }
  }

  private broadcast(room: Room) {
    const message: ServerMessage = { type: 'snapshot', snapshot: this.snapshot(room) }
    for (const member of room.members) member.connection?.send(message)
  }

  private change(room: Room, patch: Partial<RoomSnapshot>) {
    Object.assign(room.state, patch, { revision: room.state.revision + 1 })
  }

  private freeze(room: Room, reason: RoomSnapshot['pauseReason'], wantsToPlay: boolean) {
    const now = this.now()
    this.change(room, { status: 'paused', positionAtAnchor: roomPosition(room.state, now), anchorServerTime: now, pauseReason: reason, wantsToPlay })
  }

  private schedule(room: Room) {
    this.change(room, { status: 'scheduled', anchorServerTime: this.now() + START_LEAD_MS, pauseReason: null, wantsToPlay: true })
  }

  private error(connection: RoomConnection, code: string, message: string, commandId?: string) {
    const reply: ServerMessage = { type: 'error', code, message, ...(commandId ? { commandId } : {}) }
    connection.send(reply)
    return reply
  }

  receive(connection: RoomConnection, message: ClientMessage) {
    // Expiry must apply even when a reconnect races the periodic sweep.
    this.sweep()
    if (message.type === 'create' || message.type === 'join' || message.type === 'resume') {
      if (this.bindings.has(connection.id)) return this.error(connection, 'already-joined', '已加入房间')
      return this.authenticate(connection, message)
    }
    const binding = this.bindings.get(connection.id)
    if (!binding || binding.member.connection?.id !== connection.id)
      return this.error(connection, 'unauthorized', '请先加入房间')
    const { room, member } = binding
    member.lastSeen = this.now()
    if (message.type === 'ping') {
      connection.send({ type: 'pong', sentAt: message.sentAt, serverTime: this.now() })
      // Also delivers a fresh authoritative snapshot after visibility changes.
      connection.send({ type: 'snapshot', snapshot: this.snapshot(room) })
      return
    }
    if (message.type === 'leave') {
      this.tokens.delete(member.token)
      this.disconnect(connection.id)
      if (member.id === room.state.hostId) this.end(room)
      else {
        room.members = room.members.filter(m => m !== member)
        this.broadcast(room)
      }
      connection.close()
      return
    }
    if (room.state.status === 'ended') return this.error(connection, 'ended', '房间已结束')
    if (message.type === 'command') {
      const previous = member.replies.get(message.commandId)
      if (previous) { connection.send(previous.reply); return }
      let reply: ServerMessage
      if (member.id !== room.state.hostId) reply = this.error(connection, 'host-only', '仅房主可控制房间', message.commandId)
      else if (message.expectedRevision !== room.state.revision) {
        reply = this.error(connection, 'conflict', '状态已更新，请重新操作', message.commandId)
        connection.send({ type: 'snapshot', snapshot: this.snapshot(room) })
      }
      else if (message.action === 'seek' && message.position === undefined) reply = this.error(connection, 'invalid', '缺少目标位置', message.commandId)
      else {
        if (message.action === 'pause') this.freeze(room, 'user', false)
        else if (message.action === 'play') {
          const position = roomPosition(room.state, this.now())
          const restart = position >= LAB_TRACK.duration
          this.change(room, {
            status: 'preparing', wantsToPlay: true, pauseReason: null, positionAtAnchor: restart ? 0 : position, anchorServerTime: this.now(),
            ...(restart ? { playbackId: randomUUID() } : {}),
          })
        }
        else {
          const position = message.action === 'restart' ? 0 : message.position!
          this.change(room, {
            status: room.state.wantsToPlay ? 'preparing' : 'paused', positionAtAnchor: position, anchorServerTime: this.now(),
            ...(message.action === 'restart' ? { playbackId: randomUUID() } : {}),
          })
        }
        reply = { type: 'ack', commandId: message.commandId, revision: room.state.revision }
        connection.send(reply)
        this.broadcast(room)
      }
      member.replies.set(message.commandId, { at: this.now(), reply })
      if (member.replies.size > 100) member.replies.delete(member.replies.keys().next().value!)
      return
    }
    if (message.revision !== room.state.revision || message.playbackId !== room.state.playbackId) return
    member.status = message.status
    if (member.id === room.state.hostId) {
      if (message.status === 'ready' && room.state.wantsToPlay && (room.state.status === 'preparing' || room.state.pauseReason === 'host-buffering')) this.schedule(room)
      else if (message.status === 'buffering' && (room.state.status === 'playing' || room.state.status === 'scheduled')) this.freeze(room, 'host-buffering', true)
      else if ((message.status === 'blocked' || message.status === 'failed') && room.state.wantsToPlay) this.freeze(room, message.status, false)
    }
    this.broadcast(room)
  }

  private authenticate(connection: RoomConnection, message: Extract<ClientMessage, { type: 'create' | 'join' | 'resume' }>) {
    let room: Room
    let member: Member
    if (message.type === 'resume') {
      const saved = this.tokens.get(message.token)
      if (!saved || saved.room.state.status === 'ended') return this.error(connection, 'expired', '恢复凭据已失效，请重新加入')
      ;({ room, member } = saved)
      const previous = member.connection
      if (previous) {
        this.bindings.delete(previous.id)
        previous.send({ type: 'replaced' })
        previous.close()
      }
    }
    else {
      if (message.type === 'create') {
        if (this.rooms.size >= 100) return this.error(connection, 'capacity', '房间数已达上限')
        let code: string
        do { code = randomBytes(4).toString('hex').toUpperCase() } while (this.rooms.has(code))
        room = {
          state: {
            protocol: LISTEN_PROTOCOL, roomId: randomUUID(), code, revision: 0, playbackId: randomUUID(), track: { ...LAB_TRACK },
            status: 'paused', wantsToPlay: false, pauseReason: 'user', positionAtAnchor: 0, anchorServerTime: this.now(), rate: 1, hostId: '', members: [],
          }, members: [], createdAt: this.now(),
        }
        this.rooms.set(code, room)
      }
      else {
        const found = this.rooms.get(message.code.toUpperCase())
        if (!found || found.state.status === 'ended') return this.error(connection, 'not-found', '房间不存在或已结束')
        room = found
        if (room.members.length >= 5) return this.error(connection, 'capacity', '实验房间最多 5 人')
        if (!room.members.find(m => m.id === room.state.hostId)?.connection) return this.error(connection, 'host-offline', '房主暂时离线，请稍后加入')
      }
      member = { id: randomUUID(), name: message.name.trim() || '听众', token: randomBytes(32).toString('hex'), generation: 0, status: 'loading', lastSeen: this.now(), replies: new Map() }
      room.members.push(member)
      if (!room.state.hostId) room.state.hostId = member.id
      this.tokens.set(member.token, { room, member })
    }
    member.generation++
    member.connection = connection
    member.lastSeen = this.now()
    member.disconnectedAt = undefined
    member.status = 'loading'
    this.bindings.set(connection.id, { room, member })
    connection.send({ type: 'welcome', token: member.token, memberId: member.id, generation: member.generation, snapshot: this.snapshot(room) })
    this.broadcast(room)
  }

  disconnect(connectionId: string) {
    const binding = this.bindings.get(connectionId)
    if (!binding) return
    this.bindings.delete(connectionId)
    if (binding.member.connection?.id !== connectionId) return
    binding.member.connection = undefined
    binding.member.disconnectedAt = this.now()
    this.broadcast(binding.room)
  }

  private end(room: Room) {
    this.freeze(room, 'host-disconnected', false)
    room.state.status = 'ended'
    this.broadcast(room)
    for (const member of room.members) {
      this.tokens.delete(member.token)
      if (member.connection) {
        this.bindings.delete(member.connection.id)
        member.connection.close()
      }
    }
    this.rooms.delete(room.state.code)
  }

  sweep() {
    const now = this.now()
    for (const room of this.rooms.values()) {
      for (const member of room.members) {
        if (member.connection && now - member.lastSeen > CONNECTION_TIMEOUT_MS) {
          const connection = member.connection
          // Grace starts at the last valid response, matching the client's timeout.
          this.disconnect(connection.id)
          member.disconnectedAt = member.lastSeen
          connection.close()
        }
        for (const [key, value] of member.replies) if (now - value.at > 60_000) member.replies.delete(key)
      }
      const host = room.members.find(m => m.id === room.state.hostId)!
      if ((!host.connection && now - (host.disconnectedAt ?? now) >= DISCONNECT_GRACE_MS) || now - room.createdAt > 30 * 60_000) {
        this.end(room)
        continue
      }
      for (const member of room.members) {
        if (member !== host && !member.connection && now - (member.disconnectedAt ?? now) >= DISCONNECT_GRACE_MS) {
          this.tokens.delete(member.token)
          room.members = room.members.filter(m => m !== member)
          this.broadcast(room)
        }
      }
      if (room.state.status === 'scheduled' && now >= room.state.anchorServerTime) {
        // Same timeline; this transition must not cancel in-flight preparation.
        room.state.status = 'playing'
        this.broadcast(room)
      }
      if (room.state.status === 'playing' && roomPosition(room.state, now) >= LAB_TRACK.duration) {
        this.freeze(room, 'user', false)
        this.broadcast(room)
      }
    }
  }
}
