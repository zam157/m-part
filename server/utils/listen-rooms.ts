import type { ClientMessage, MemberStatus, RoomSnapshot, ServerMessage } from '../../shared/types/listen-room'
import { randomBytes, randomInt, randomUUID } from 'node:crypto'
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
  message?: string
  connection?: RoomConnection
  lastSeen: number
  disconnectedAt?: number
  replies: Map<string, { at: number, reply: ServerMessage }>
}
interface Room { state: RoomSnapshot, members: Member[], retired: Member[], createdAt: number, order: string[] }

/** Owns ordering; injectable time makes disconnect and recovery races testable. */
export class ListenRooms {
  private rooms = new Map<string, Room>()
  private bindings = new Map<string, { room: Room, member: Member }>()
  private tokens = new Map<string, { room: Room, member: Member }>()

  constructor(private now = () => performance.now()) {}

  private snapshot(room: Room): RoomSnapshot {
    return {
      ...room.state,
      track: { ...room.state.track }, queue: room.state.queue.map(t => ({ ...t })),
      members: room.members.map(m => ({ id: m.id, name: m.name, generation: m.generation, online: !!m.connection, status: m.status, message: m.message })),
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

  private remember(member: Member, commandId: string, reply: ServerMessage) {
    member.replies.set(commandId, { at: this.now(), reply })
    if (member.replies.size > 100) member.replies.delete(member.replies.keys().next().value!)
  }

  private select(room: Room, index: number | null, wantsToPlay = true) {
    const track = index === null ? undefined : room.state.queue[index]
    this.change(room, {
      currentIndex: track ? index : null, track: { id: track?.queueItemId ?? '', duration: track?.duration ?? 0 },
      positionAtAnchor: 0, anchorServerTime: this.now(), playbackId: randomUUID(),
      wantsToPlay: !!track && wantsToPlay, status: track && wantsToPlay ? 'preparing' : 'paused', pauseReason: track && wantsToPlay ? null : 'user',
    })
  }

  private musicCommand(room: Room, message: Extract<ClientMessage, { type: 'command' }>): string | undefined {
    if (room.state.kind !== 'music') return '实验房间不支持音乐队列操作'
    const state = room.state
    const current = state.currentIndex === null ? undefined : state.queue[state.currentIndex]
    const makeTrack = (t: NonNullable<typeof message.track>) => ({ ...t, queueItemId: randomUUID() })
    if (message.action === 'queue') {
      if (!message.tracks) return '缺少播放队列'
      const seen = new Set<string>()
      state.queue = message.tracks.filter(t => { const key = `${t.provider}:${t.id}`; if (seen.has(key)) return false; seen.add(key); return true }).map(makeTrack)
      room.order = []
      this.select(room, state.queue.length ? 0 : null)
    }
    else if (message.action === 'select' || message.action === 'remove') {
      const index = state.queue.findIndex(t => t.queueItemId === message.queueItemId)
      if (index < 0) return '曲目已经不在房间队列中'
      if (message.action === 'select') this.select(room, index)
      else {
        state.queue = state.queue.filter((_, i) => i !== index)
        if (current?.queueItemId === message.queueItemId) this.select(room, state.queue.length ? Math.min(index, state.queue.length - 1) : null, state.wantsToPlay)
        else this.change(room, { currentIndex: current ? state.queue.findIndex(t => t.queueItemId === current.queueItemId) : null })
      }
    }
    else if (message.action === 'append' || message.action === 'add-next') {
      if (!message.track) return '缺少曲目资料'
      const existing = state.queue.find(t => t.provider === message.track!.provider && t.id === message.track!.id)
      if (!existing && state.queue.length >= 1_000) return '房间队列最多 1000 首'
      const target = existing ?? makeTrack(message.track)
      if (message.action === 'append' || !current) {
        if (!existing) state.queue = [...state.queue, target]
        this.select(room, state.queue.findIndex(t => t.queueItemId === target.queueItemId))
      }
      else if (target.queueItemId !== current.queueItemId) {
        const list = state.queue.filter(t => t.queueItemId !== target.queueItemId)
        const index = list.findIndex(t => t.queueItemId === current.queueItemId)
        list.splice(index + 1, 0, target)
        this.change(room, { queue: list, currentIndex: index })
        room.order = []
      }
    }
    else if (message.action === 'mode') {
      if (!message.mode) return '缺少播放模式'
      room.order = []
      this.change(room, { playMode: message.mode })
    }
    else if (['next', 'previous', 'ended'].includes(message.action)) {
      if (!current) return '房间队列为空'
      if (message.action === 'ended' && (!state.wantsToPlay || state.status === 'paused')) return
      if (message.action === 'ended' && state.playMode === 'order' && state.currentIndex === state.queue.length - 1) {
        this.freeze(room, 'user', false)
        return
      }
      let index = state.currentIndex!
      if (!(message.action === 'ended' && state.playMode === 'single-loop')) {
        const delta = message.action === 'previous' ? -1 : 1
        if (state.playMode === 'random') {
          const ids = new Set(state.queue.map(t => t.queueItemId))
          room.order = room.order.filter(id => ids.has(id))
          const added = state.queue.map(t => t.queueItemId).filter(id => !room.order.includes(id))
          for (let i = added.length - 1; i > 0; i--) { const j = randomInt(i + 1); [added[i], added[j]] = [added[j]!, added[i]!] }
          room.order.push(...added)
          const nextId = room.order[(room.order.indexOf(current.queueItemId) + delta + room.order.length) % room.order.length]
          index = state.queue.findIndex(t => t.queueItemId === nextId)
        }
        else index = (index + delta + state.queue.length) % state.queue.length
      }
      this.select(room, index)
    }
    return undefined
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
        const musicActions = ['queue', 'select', 'append', 'add-next', 'remove', 'mode', 'next', 'previous', 'ended']
        if (musicActions.includes(message.action)) {
          const failure = this.musicCommand(room, message)
          if (failure) {
            reply = this.error(connection, 'invalid', failure, message.commandId)
            this.remember(member, message.commandId, reply)
            return
          }
        }
        else if (message.action === 'play' && room.state.kind === 'music' && !room.state.queue.length) {
          reply = this.error(connection, 'empty', '先选择歌曲加入房间队列', message.commandId)
          this.remember(member, message.commandId, reply)
          return
        }
        else if (message.action === 'pause') this.freeze(room, 'user', false)
        else if (message.action === 'play') {
          const position = roomPosition(room.state, this.now())
          const restart = position >= room.state.track.duration
          this.change(room, {
            status: 'preparing', wantsToPlay: true, pauseReason: null, positionAtAnchor: restart ? 0 : position, anchorServerTime: this.now(),
            ...(restart ? { playbackId: randomUUID() } : {}),
          })
        }
        else {
          const position = message.action === 'restart' ? 0 : Math.min(message.position!, room.state.track.duration)
          this.change(room, {
            status: room.state.wantsToPlay ? 'preparing' : 'paused', positionAtAnchor: position, anchorServerTime: this.now(),
            ...(message.action === 'restart' ? { playbackId: randomUUID() } : {}),
          })
        }
        reply = { type: 'ack', commandId: message.commandId, revision: room.state.revision }
        connection.send(reply)
        this.broadcast(room)
      }
      this.remember(member, message.commandId, reply)
      return
    }
    if (message.revision !== room.state.revision || message.playbackId !== room.state.playbackId) return
    member.status = message.status
    member.message = message.message
    if (member.id === room.state.hostId) {
      if (message.status === 'ready' && room.state.wantsToPlay && (room.state.status === 'preparing' || room.state.pauseReason === 'host-buffering')) {
        if (message.duration && room.state.kind === 'music') {
          const item = room.state.currentIndex === null ? undefined : room.state.queue[room.state.currentIndex]
          if (item) { item.duration = message.duration; room.state.track.duration = message.duration }
        }
        this.schedule(room)
      }
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
      if (!room.members.includes(member)) {
        if (room.members.length >= 5) return this.error(connection, 'capacity', '房间已满，暂时无法恢复，请稍后重新加入')
        room.retired = room.retired.filter(m => m !== member)
        room.members.push(member)
      }
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
            kind: message.kind ?? 'lab', queue: [], currentIndex: null, playMode: 'order',
            status: 'paused', wantsToPlay: false, pauseReason: 'user', positionAtAnchor: 0, anchorServerTime: this.now(), rate: 1, hostId: '', members: [],
          }, members: [], retired: [], createdAt: this.now(), order: [],
        }
        if (message.kind === 'music') {
          room.state.queue = (message.tracks ?? []).map(t => ({ ...t, queueItemId: randomUUID() }))
          this.select(room, room.state.queue.length ? Math.min(message.index ?? 0, room.state.queue.length - 1) : null, message.autoplay ?? false)
          room.state.positionAtAnchor = Math.min(message.position ?? 0, room.state.track.duration)
        }
        this.rooms.set(code, room)
      }
      else {
        const found = this.rooms.get(message.code.toUpperCase())
        if (!found || found.state.status === 'ended') return this.error(connection, 'not-found', '房间不存在或已结束')
        if (message.kind && message.kind !== found.state.kind) return this.error(connection, 'not-found', '该房间不是音乐房间')
        room = found
        if (room.members.length >= 5) return this.error(connection, 'capacity', '房间最多 5 人')
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
    for (const member of room.retired) this.tokens.delete(member.token)
    this.rooms.delete(room.state.code)
  }

  sweep() {
    const now = this.now()
    for (const room of this.rooms.values()) {
      room.retired = room.retired.filter(member => {
        if (now - (member.disconnectedAt ?? now) < 10 * 60_000) return true
        this.tokens.delete(member.token)
        return false
      })
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
      const lifetime = room.state.kind === 'music' ? 12 * 60 * 60_000 : 30 * 60_000
      if ((!host.connection && now - (host.disconnectedAt ?? now) >= DISCONNECT_GRACE_MS) || now - room.createdAt > lifetime) {
        this.end(room)
        continue
      }
      for (const member of room.members) {
        if (member !== host && !member.connection && now - (member.disconnectedAt ?? now) >= DISCONNECT_GRACE_MS) {
          room.retired.push(member)
          if (room.retired.length > 50) this.tokens.delete(room.retired.shift()!.token)
          room.members = room.members.filter(m => m !== member)
          this.broadcast(room)
        }
      }
      if (room.state.status === 'scheduled' && now >= room.state.anchorServerTime) {
        // Same timeline; this transition must not cancel in-flight preparation.
        room.state.status = 'playing'
        this.broadcast(room)
      }
      if (room.state.kind === 'lab' && room.state.status === 'playing' && roomPosition(room.state, now) >= room.state.track.duration) {
        this.freeze(room, 'user', false)
        this.broadcast(room)
      }
    }
  }
}
