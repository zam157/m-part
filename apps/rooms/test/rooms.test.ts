import type { ClientMessage, RoomSnapshot, ServerMessage } from '@m-part/listen-core/protocol'
import { beforeEach, describe, expect, it } from 'vitest'
import * as v from 'valibot'
import { ListenRooms } from '../server/utils/listen-rooms'
import { clientMessage, DISCONNECT_GRACE_MS, START_LEAD_MS } from '@m-part/listen-core/protocol'
import { roomPosition } from '@m-part/listen-core/clock'

describe('room authority and recovery', () => {
  let now: number
  let rooms: ListenRooms
  function peer(id: string) {
    const messages: ServerMessage[] = []
    return { id, messages, closed: false, send(message: ServerMessage) { messages.push(structuredClone(message)) }, close() { this.closed = true } }
  }
  let host: ReturnType<typeof peer>
  let member: ReturnType<typeof peer>
  const send = (p: ReturnType<typeof peer>, msg: ClientMessage) => rooms.receive(p, msg)
  const snapshot = (p = host): RoomSnapshot => {
    const msg = p.messages.findLast(m => m.type === 'snapshot' || m.type === 'welcome')!
    return (msg as Extract<ServerMessage, { type: 'snapshot' | 'welcome' }>).snapshot
  }
  const welcome = (p = host) => p.messages.find(m => m.type === 'welcome') as Extract<ServerMessage, { type: 'welcome' }>
  const command = (action: 'play' | 'pause' | 'seek' | 'restart', position?: number, id = crypto.randomUUID()) => {
    const msg: ClientMessage = { type: 'command', action, position, commandId: id, expectedRevision: snapshot().revision }
    send(host, msg)
    return msg
  }
  const report = (status: 'ready' | 'buffering' | 'blocked' | 'following', p = host, state = snapshot(p)) => send(p, { type: 'report', status, revision: state.revision, playbackId: state.playbackId })
  beforeEach(() => {
    now = 1_000
    rooms = new ListenRooms(() => now)
    host = peer('host'); member = peer('member')
    send(host, { type: 'create', name: '房主', protocol: 1 })
    send(member, { type: 'join', name: '成员', code: snapshot().code, protocol: 1 })
  })

  it('keeps tokens private, membership separate from the control revision', () => {
    expect(snapshot().revision).toBe(0)
    expect(snapshot().members).toHaveLength(2)
    expect(JSON.stringify(snapshot())).not.toContain(welcome().token)
    report('ready', member)
    expect(snapshot().revision).toBe(0)
  })
  it('does not let room codes or self-declared roles grant control', () => {
    send(member, { type: 'command', commandId: 'bad', action: 'play', expectedRevision: 0 })
    expect(member.messages.at(-1)).toMatchObject({ type: 'error', code: 'host-only' })
    expect(snapshot().wantsToPlay).toBe(false)
  })
  it('waits for host readiness then schedules a future start', () => {
    command('play')
    report('ready', member)
    expect(snapshot().status).toBe('preparing')
    report('ready')
    expect(snapshot()).toMatchObject({ status: 'scheduled', anchorServerTime: now + START_LEAD_MS })
    expect(roomPosition(snapshot(), now)).toBe(0)
    now += START_LEAD_MS + 2_000
    rooms.sweep()
    expect(snapshot().status).toBe('playing')
    expect(roomPosition(snapshot(), now)).toBe(2)
  })
  it('makes duplicate commands idempotent even after the timeline changed', () => {
    const msg = command('play')
    report('ready')
    const revision = snapshot().revision
    send(host, msg)
    expect((host.messages.at(-1) as { revision: number }).revision).toBe(1)
    send(host, { type: 'ping', sentAt: 0 })
    expect(snapshot().revision).toBe(revision)
  })
  it('rejects stale controls with a current snapshot instead of replaying them', () => {
    const old = snapshot().revision
    command('pause')
    send(host, { type: 'command', action: 'play', commandId: 'stale', expectedRevision: old })
    expect(host.messages.at(-2)).toMatchObject({ type: 'error', code: 'conflict' })
    expect(snapshot()).toMatchObject({ status: 'paused', wantsToPlay: false })
  })
  it('ignores old readiness and start failure after seek within the same track', () => {
    command('play')
    const old = snapshot()
    command('seek', 20)
    report('ready', host, old); report('blocked', host, old)
    expect(snapshot()).toMatchObject({ status: 'preparing', positionAtAnchor: 20 })
    report('ready')
    expect(snapshot().status).toBe('scheduled')
  })
  it('freezes at the authoritative anchor during host buffering, not at a client-supplied time', () => {
    command('play'); report('ready')
    now += START_LEAD_MS + 3_000
    report('buffering')
    expect(snapshot()).toMatchObject({ status: 'paused', pauseReason: 'host-buffering', positionAtAnchor: 3, wantsToPlay: true })
    now += 1_000
    report('ready')
    expect(snapshot()).toMatchObject({ status: 'scheduled', positionAtAnchor: 3 })
  })
  it('never resumes buffering after a manual pause or old ready notification', () => {
    command('play'); report('ready'); report('buffering')
    const buffering = snapshot()
    command('pause')
    report('ready', host, buffering); report('ready')
    expect(snapshot()).toMatchObject({ status: 'paused', wantsToPlay: false, pauseReason: 'user' })
  })
  it('a blocked host freezes the room until an explicit play intent', () => {
    command('play'); report('ready'); report('blocked'); report('ready')
    expect(snapshot()).toMatchObject({ status: 'paused', pauseReason: 'blocked', wantsToPlay: false })
    const revision = snapshot().revision
    report('blocked'); report('blocked')
    expect(snapshot().revision).toBe(revision)
    command('play'); report('ready')
    expect(snapshot().status).toBe('scheduled')
  })
  it('member buffering and active pause do not change the room timeline', () => {
    command('play'); report('ready')
    const state = snapshot()
    report('buffering', member)
    send(member, { type: 'report', status: 'away', revision: state.revision, playbackId: state.playbackId })
    expect(snapshot().revision).toBe(state.revision)
    expect(snapshot().status).toBe('scheduled')
  })
  it('refresh resumes host identity and rejects late old socket messages/close', () => {
    const refreshed = peer('refreshed')
    send(refreshed, { type: 'resume', token: welcome().token, protocol: 1 })
    expect(welcome(refreshed)).toMatchObject({ memberId: welcome().memberId, generation: 2 })
    expect(host.closed).toBe(true)
    rooms.disconnect(host.id)
    send(host, { type: 'command', action: 'play', commandId: 'old-connection', expectedRevision: 0 })
    expect(host.messages.at(-1)).toMatchObject({ type: 'error', code: 'unauthorized' })
    expect(snapshot(refreshed).members.find(m => m.id === welcome().memberId)?.online).toBe(true)
  })
  it('expires resume credentials at the grace boundary even before the next sweep', () => {
    const token = welcome().token
    rooms.disconnect(host.id)
    now += DISCONNECT_GRACE_MS / 2
    send(member, { type: 'ping', sentAt: now })
    now += DISCONNECT_GRACE_MS / 2
    const refreshed = peer('late-refresh')
    send(refreshed, { type: 'resume', token, protocol: 1 })
    expect(refreshed.messages.at(-1)).toMatchObject({ type: 'error', code: 'expired' })
    expect(snapshot(member).status).toBe('ended')
  })
  it('detects silently dead connections and revokes their authority', () => {
    now += 13_000
    rooms.sweep()
    expect(host.closed).toBe(true)
    now += 8_000
    const refreshed = peer('too-late')
    send(refreshed, { type: 'resume', token: welcome().token, protocol: 1 })
    expect(refreshed.messages.at(-1)).toMatchObject({ type: 'error', code: 'expired' })
  })
  it('revokes membership on explicit leave and bounds room membership', () => {
    for (let i = 0; i < 3; i++) send(peer(`extra-${i}`), { type: 'join', protocol: 1, name: 'extra', code: snapshot().code })
    const sixth = peer('sixth')
    send(sixth, { type: 'join', protocol: 1, name: 'extra', code: snapshot().code })
    expect(sixth.messages.at(-1)).toMatchObject({ type: 'error', code: 'capacity' })
    send(member, { type: 'leave' })
    const resumed = peer('left')
    send(resumed, { type: 'resume', token: welcome(member).token, protocol: 1 })
    expect(resumed.messages.at(-1)).toMatchObject({ type: 'error', code: 'expired' })
  })
  it('new playback instance invalidates readiness from the previous play', () => {
    command('play')
    const old = snapshot()
    command('restart')
    expect(snapshot().playbackId).not.toBe(old.playbackId)
    report('ready', host, old)
    expect(snapshot().status).toBe('preparing')
  })
  it('restarts a finished track with a new instance instead of scheduling at its end', () => {
    command('seek', 90)
    const previous = snapshot().playbackId
    command('play')
    expect(snapshot()).toMatchObject({ status: 'preparing', positionAtAnchor: 0 })
    expect(snapshot().playbackId).not.toBe(previous)
  })
})

it('rejects untrusted fields, missing versions and non-finite or out-of-range seeks', () => {
  const command = { type: 'command', commandId: 'one', expectedRevision: 0, action: 'seek', position: 10 }
  expect(v.safeParse(clientMessage, command).success).toBe(true)
  for (const position of [NaN, Infinity, -1, 86_401]) expect(v.safeParse(clientMessage, { ...command, position }).success).toBe(false)
  expect(v.safeParse(clientMessage, { ...command, src: 'https://arbitrary.example' }).success).toBe(false)
  expect(v.safeParse(clientMessage, { type: 'create', protocol: 1, name: 'x', role: 'host' }).success).toBe(false)
})
