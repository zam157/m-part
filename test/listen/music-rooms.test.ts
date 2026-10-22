import type { ClientMessage, RoomSnapshot, ServerMessage } from '../../shared/types/listen-room'
import { beforeEach, describe, expect, it } from 'vitest'
import * as v from 'valibot'
import { ListenRooms } from '../../server/utils/listen-rooms'
import { clientMessage, serverMessage } from '../../shared/types/listen-room'

const song = (id: string) => ({ provider: 'netease' as const, id, title: `Song ${id}`, artist: 'Artist', duration: 120, coverUrl: '' })
describe('real music room queue authority', () => {
  let now: number
  let rooms: ListenRooms
  const peer = (id: string) => ({ id, messages: [] as ServerMessage[], send(message: ServerMessage) { this.messages.push(structuredClone(message)) }, close() {} })
  let host: ReturnType<typeof peer>
  let member: ReturnType<typeof peer>
  function state(p = host): RoomSnapshot {
    const message = p.messages.findLast(m => m.type === 'snapshot' || m.type === 'welcome') as Extract<ServerMessage, { type: 'snapshot' | 'welcome' }>
    return message.snapshot
  }
  function send(p: ReturnType<typeof peer>, message: ClientMessage) { rooms.receive(p, v.parse(clientMessage, message)) }
  function command(action: Extract<ClientMessage, { type: 'command' }>['action'], extra: Partial<Extract<ClientMessage, { type: 'command' }>> = {}, p = host) {
    send(p, { type: 'command', commandId: crypto.randomUUID(), expectedRevision: state(p).revision, action, ...extra })
  }
  function ready() {
    const s = state()
    send(host, { type: 'report', revision: s.revision, playbackId: s.playbackId, status: 'ready', duration: 120 })
  }
  beforeEach(() => {
    now = 0; rooms = new ListenRooms(() => now); host = peer('host'); member = peer('member')
    send(host, { type: 'create', protocol: 1, kind: 'music', name: 'Host', tracks: [song('1'), song('2'), song('3')], index: 1, position: 12, autoplay: true })
    send(member, { type: 'join', protocol: 1, kind: 'music', name: 'Member', code: state().code })
  })
  it('starts with the host selection and position, validates its outgoing protocol', () => {
    expect(state()).toMatchObject({ kind: 'music', currentIndex: 1, positionAtAnchor: 12, status: 'preparing' })
    for (const message of host.messages) expect(v.safeParse(serverMessage, message).success).toBe(true)
    ready()
    expect(state()).toMatchObject({ status: 'scheduled', track: { duration: 120 } })
  })
  it('shares no source, credentials or HTML injected into public song titles', () => {
    command('append', { track: { ...song('new'), title: '<img src=x onerror=evil()>Hello' } })
    expect(state().queue.at(-1)?.title).toBe('Hello')
    expect(v.safeParse(clientMessage, { type: 'create', kind: 'music', protocol: 1, name: 'x', tracks: [{ ...song('x'), src: 'https://private.example/signed' }] }).success).toBe(false)
  })
  it('only the host can change queue, seek, mode or advance on ended', () => {
    const before = state().revision
    for (const action of ['next', 'ended', 'queue', 'mode'] as const) command(action, { tracks: [], mode: 'random' }, member)
    expect(state().revision).toBe(before)
    expect(member.messages.at(-1)).toMatchObject({ type: 'error', code: 'host-only' })
  })
  it('append plays the selected song once and next-in-queue keeps current playback', () => {
    ready()
    command('add-next', { track: song('4') })
    expect(state().queue.map(t => t.id)).toEqual(['1', '2', '4', '3'])
    expect(state()).toMatchObject({ currentIndex: 1, status: 'scheduled' })
    command('append', { track: song('4') })
    expect(state().queue).toHaveLength(4)
    expect(state().queue[state().currentIndex!]!.id).toBe('4')
    expect(state().status).toBe('preparing')
  })
  it('deleting an earlier track preserves the selected item and timeline', () => {
    ready(); const before = state()
    command('remove', { queueItemId: before.queue[0]!.queueItemId })
    expect(state()).toMatchObject({ currentIndex: 0, playbackId: before.playbackId, positionAtAnchor: 12, status: 'scheduled' })
    expect(state().queue[0]!.id).toBe('2')
  })
  it('deleting the selected track changes the playback instance, clearing stops the room', () => {
    const before = state()
    command('remove', { queueItemId: before.queue[1]!.queueItemId })
    expect(state().playbackId).not.toBe(before.playbackId)
    expect(state().queue[state().currentIndex!]!.id).toBe('3')
    command('queue', { tracks: [] })
    expect(state()).toMatchObject({ currentIndex: null, status: 'paused', wantsToPlay: false, queue: [] })
  })
  it('automatic ended advances once, single loop replays, order stops at last', () => {
    ready(); command('ended')
    expect(state().currentIndex).toBe(2)
    ready(); command('ended')
    expect(state()).toMatchObject({ currentIndex: 2, status: 'paused', wantsToPlay: false })
    command('mode', { mode: 'single-loop' }); command('play'); ready()
    const previous = state().playbackId
    command('ended')
    expect(state().currentIndex).toBe(2)
    expect(state().playbackId).not.toBe(previous)
  })
  it('loop and random choices are made on the server and identical for members', () => {
    command('mode', { mode: 'loop' }); command('next'); command('next')
    expect(state().currentIndex).toBe(0)
    command('mode', { mode: 'random' }); command('next')
    expect(state().currentIndex).toBe(state(member).currentIndex)
    const selected = state().currentIndex
    command('next'); command('previous')
    expect(state().currentIndex).toBe(selected)
  })
  it('uses actual host media duration and clamps seeks to the current track', () => {
    const s = state()
    send(host, { type: 'report', status: 'ready', revision: s.revision, playbackId: s.playbackId, duration: 123 })
    expect(state().track.duration).toBe(123)
    command('seek', { position: 999 })
    expect(state().positionAtAnchor).toBe(123)
  })
  it('supports empty rooms and adding their first track without phantom playback', () => {
    command('queue', { tracks: [] }); command('play')
    expect(host.messages.at(-1)).toMatchObject({ type: 'error', code: 'empty' })
    command('append', { track: song('first') })
    expect(state()).toMatchObject({ status: 'preparing', currentIndex: 0, wantsToPlay: true })
  })
  it('keeps a disconnected member identity recoverable after releasing its slot', () => {
    const original = member.messages.find(m => m.type === 'welcome') as Extract<ServerMessage, { type: 'welcome' }>
    rooms.disconnect(member.id)
    for (let i = 0; i < 3; i++) { now += 10_000; send(host, { type: 'ping', sentAt: now }) }
    expect(state().members).toHaveLength(1)
    const returning = peer('returning')
    send(returning, { type: 'resume', protocol: 1, token: original.token })
    const welcome = returning.messages.find(m => m.type === 'welcome') as Extract<ServerMessage, { type: 'welcome' }>
    expect(welcome.memberId).toBe(original.memberId)
    expect(state().members).toHaveLength(2)
    expect(welcome.snapshot.members.find(m => m.id === original.memberId)?.generation).toBe(2)
  })
})
