import type { ClientMessage, RoomHistoryEntry, MemberStatus, RoomSnapshot, RoomSource, ServerMessage } from '@m-part/listen-core/protocol'
import { randomBytes, randomInt, randomUUID } from 'node:crypto'
import { CONNECTION_TIMEOUT_MS, DISCONNECT_GRACE_MS, LAB_TRACK, LISTEN_PROTOCOL, ROOM_HISTORY_LIMIT, START_LEAD_MS, currentRoomSource } from '@m-part/listen-core/protocol'
import { roomPosition } from '@m-part/listen-core/clock'

export interface RoomConnection {
  id: string
  send: (message: ServerMessage) => void
  close: () => void
}
interface Member {
  admin: boolean
  activityBudget?: { at: number, count: number }
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

  constructor(private now = () => performance.now(), private onSnapshot: (state: RoomSnapshot) => void = () => {}, private wallTime = () => Date.now()) {}

  get hasRooms() { return this.rooms.size > 0 }

  private snapshot(room: Room): RoomSnapshot {
    return {
      ...room.state,
      track: { ...room.state.track }, queue: room.state.queue.map(t => ({ ...t })),
      history: room.state.history.map(entry => ({ ...entry })),
      members: room.members.map(m => ({ role: m.id === room.state.hostId ? 'host' : m.admin ? 'admin' : 'member', id: m.id, name: m.name, generation: m.generation, online: !!m.connection, status: m.status, message: m.message })),
    }
  }

  private record(room: Room, kind: RoomHistoryEntry['kind'], text: string, member?: Member) {
    room.state.history.push({ id: ++room.state.activityVersion, at: this.wallTime(), kind, text: text.slice(0, 500), ...(member ? { memberId: member.id, name: member.name } : {}) })
    if (room.state.history.length > ROOM_HISTORY_LIMIT) room.state.history.splice(0, room.state.history.length - ROOM_HISTORY_LIMIT)
  }

  private recordCommand(room: Room, member: Member, message: Extract<ClientMessage, { type: 'command' }>, previousTitle?: string) {
    const current = room.state.currentIndex === null ? undefined : room.state.queue[room.state.currentIndex]
    const title = current?.title ?? '歌曲'
    const labels: Record<typeof message.action, string> = {
      play: '开始播放', pause: '暂停了全员播放', seek: `将进度调整至 ${Math.floor(room.state.positionAtAnchor / 60)}:${String(Math.floor(room.state.positionAtAnchor % 60)).padStart(2, '0')}`,
      restart: '重新播放了当前歌曲', queue: `替换了播放队列（${room.state.queue.length} 首）`,
      select: `切换到「${title}」`, append: `添加并播放「${title}」`, 'add-next': `将「${message.track?.title ?? '歌曲'}」设为下一首`,
      'append-many': `批量加入 ${message.tracks?.length ?? 0} 首${message.autoplay ? `并播放「${title}」` : message.placement === 'next' ? '到下一首' : '到队列'}`,
      remove: `移除了「${previousTitle ?? '歌曲'}」`, mode: `切换播放模式：${{ order: '顺序播放', loop: '列表循环', random: '随机播放', 'single-loop': '单曲循环' }[room.state.playMode]}`,
      next: `切换下一首「${title}」`, previous: `切换上一首「${title}」`, ended: room.state.wantsToPlay ? `自动播放「${title}」` : '队列播放结束',
    }
    this.record(room, 'operation', labels[message.action], member)
  }

  private broadcast(room: Room) {
    const message: ServerMessage = { type: 'snapshot', snapshot: this.snapshot(room) }
    this.onSnapshot(message.snapshot)
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
      ...(room.state.source ? { source: currentRoomSource({ ...room.state.source, error: undefined }, track?.provider) } : {}),
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
    else if (message.action === 'append-many') {
      if (!message.tracks?.length) return '请选择要加入的分 P'
      const seen = new Set<string>()
      const selected = message.tracks.filter(t => { const key = `${t.provider}:${t.id}`; if (seen.has(key)) return false; seen.add(key); return true })
        .map(t => state.queue.find(old => old.provider === t.provider && old.id === t.id) ?? makeTrack(t))
      const ids = new Set(selected.map(t => t.queueItemId))
      let queue = [...state.queue]
      if (message.placement === 'next' && current) {
        queue = queue.filter(t => !ids.has(t.queueItemId) || t.queueItemId === current.queueItemId)
        queue.splice(queue.findIndex(t => t.queueItemId === current.queueItemId) + 1, 0, ...selected.filter(t => t.queueItemId !== current.queueItemId))
      }
      else queue.push(...selected.filter(t => !queue.some(old => old.queueItemId === t.queueItemId)))
      if (queue.length > 1_000) return '房间队列最多 1000 首'
      state.queue = queue
      room.order = []
      if (message.autoplay || !current) this.select(room, queue.findIndex(t => t.queueItemId === selected[0]!.queueItemId), !!message.autoplay)
      else this.change(room, { currentIndex: queue.findIndex(t => t.queueItemId === current.queueItemId) })
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
        this.record(room, 'operation', '离开了房间', member)
        room.members = room.members.filter(m => m !== member)
        this.broadcast(room)
      }
      connection.close()
      return
    }
    if (room.state.status === 'ended') return this.error(connection, 'ended', '房间已结束')
    if (message.type === 'chat' || message.type === 'role') {
      const previous = member.replies.get(message.commandId)
      if (previous) { connection.send(previous.reply); return }
      let reply: ServerMessage
      if (room.state.kind !== 'music') reply = this.error(connection, 'invalid', '实验房间不支持聊天或管理员', message.commandId)
      else if (message.type === 'role' && member.id !== room.state.hostId) reply = this.error(connection, 'host-only', '仅房主可授权或撤销管理员', message.commandId)
      else {
        const budget = member.activityBudget && this.now() - member.activityBudget.at < 10_000 ? member.activityBudget : { at: this.now(), count: 0 }
        member.activityBudget = budget
        if (++budget.count > 8) reply = this.error(connection, 'rate-limit', '发送或操作过于频繁，请稍后再试', message.commandId)
        else if (message.type === 'role') {
          const target = [...room.members, ...room.retired].find(m => m.id === message.memberId)
          if (!target || target.id === room.state.hostId) reply = this.error(connection, 'invalid', '请选择房间内的其他成员', message.commandId)
          else {
            const admin = message.role === 'admin'
            if (target.admin !== admin) {
              target.admin = admin
              this.record(room, 'operation', `${admin ? '授权' : '撤销'}「${target.name}」${admin ? '为管理员' : '的管理员权限'}`, member)
            }
            reply = { type: 'ack', commandId: message.commandId, revision: room.state.revision }
            connection.send(reply); this.broadcast(room)
          }
        }
        else {
          this.record(room, 'chat', message.text, member)
          reply = { type: 'ack', commandId: message.commandId, revision: room.state.revision }
          connection.send(reply); this.broadcast(room)
        }
      }
      this.remember(member, message.commandId, reply)
      return
    }
    if (message.type === 'command') {
      const previous = member.replies.get(message.commandId)
      if (previous) { connection.send(previous.reply); return }
      let reply: ServerMessage
      if (member.id !== room.state.hostId && (!member.admin || room.state.kind !== 'music' || message.action === 'ended')) reply = this.error(connection, 'host-only', '仅房主或管理员可控制房间（自动切歌由房主执行）', message.commandId)
      else if (!room.members.find(m => m.id === room.state.hostId)?.connection) reply = this.error(connection, 'host-offline', '房主暂时离线，恢复连接后才能控制播放', message.commandId)
      else if (message.expectedRevision !== room.state.revision) {
        reply = this.error(connection, 'conflict', '状态已更新，请重新操作', message.commandId)
        connection.send({ type: 'snapshot', snapshot: this.snapshot(room) })
      }
      else if (message.action === 'seek' && message.position === undefined) reply = this.error(connection, 'invalid', '缺少目标位置', message.commandId)
      else {
        const previousTitle = room.state.queue.find(t => t.queueItemId === message.queueItemId)?.title
        const previousRevision = room.state.revision
        const musicActions = ['queue', 'select', 'append', 'add-next', 'append-many', 'remove', 'mode', 'next', 'previous', 'ended']
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
        if (room.state.revision !== previousRevision) this.recordCommand(room, member, message, previousTitle)
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

  /** HTTP control is bound to a live member, never merely a room code. */
  authorize(token: string, roomId: string) {
    this.sweep()
    const binding = this.tokens.get(token)
    if (!binding || binding.room.state.roomId !== roomId || !binding.member.connection || binding.room.state.status === 'ended') throw new Error('房间成员身份已失效，请重新连接')
    return { memberId: binding.member.id, generation: binding.member.generation, isHost: binding.member.id === binding.room.state.hostId, snapshot: this.snapshot(binding.room) }
  }

  updateSource(token: string, roomId: string, expectedRevision: number, patch: Partial<RoomSource>, commit: () => void = () => {}, options: { affectsPlayback?: boolean, operation?: string } = {}) {
    const auth = this.authorize(token, roomId)
    if (!auth.isHost) throw new Error('仅房主可管理房间音源')
    if (auth.snapshot.kind !== 'music') throw new Error('实验房间不支持托管音源')
    if (auth.snapshot.revision !== expectedRevision) throw new Error('房间状态已更新，请重新操作')
    const { room } = this.tokens.get(token)!
    const source = currentRoomSource({ mode: 'independent', version: 0, credential: 'none', ...room.state.source, ...patch }, room.state.currentIndex === null ? undefined : room.state.queue[room.state.currentIndex]?.provider)
    commit()
    if (options.affectsPlayback !== false) {
      source.version++
      const failed = source.mode === 'hosted' && !!source.error
      const wanted = room.state.wantsToPlay && !failed
      this.change(room, { source, wantsToPlay: wanted, positionAtAnchor: roomPosition(room.state, this.now()), anchorServerTime: this.now(), status: wanted ? 'preparing' : 'paused', pauseReason: failed ? 'failed' : wanted ? null : 'user' })
    }
    else room.state.source = source
    this.record(room, 'operation', options.operation ?? (patch.mode === 'independent' ? '切换为各自取源' : '重新准备房间托管音源'), this.tokens.get(token)!.member)
    this.broadcast(room)
    return source
  }

  sourceFailed(roomId: string, version: number, message: string, invalidCredential = false) {
    const room = [...this.rooms.values()].find(r => r.state.roomId === roomId)
    if (!room || room.state.source?.version !== version || room.state.source.mode !== 'hosted' || room.state.source.error) return
    this.freeze(room, 'failed', false)
    this.record(room, 'operation', '房间托管音源不可用，已暂停播放')
    const source = room.state.source
    const provider = source.provider
    const account = provider ? source.accounts?.[provider] : undefined
    room.state.source = currentRoomSource({ ...source, error: message, ...(invalidCredential && provider && account ? { accounts: { ...source.accounts, [provider]: { ...account, credential: 'invalid' } } } : {}) }, provider)
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
            source: { mode: 'independent', version: 0, credential: 'none', accounts: {} },
            status: 'paused', wantsToPlay: false, pauseReason: 'user', positionAtAnchor: 0, anchorServerTime: this.now(), rate: 1, hostId: '', members: [], activityVersion: 0, history: [],
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
      member = { admin: false, id: randomUUID(), name: message.name.trim() || '听众', token: randomBytes(32).toString('hex'), generation: 0, status: 'loading', lastSeen: this.now(), replies: new Map() }
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
    this.record(room, 'operation', message.type === 'create' ? '创建了房间' : message.type === 'resume' ? '重新连接了房间' : '加入了房间', member)
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
    this.record(room, 'operation', '房间已结束')
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
