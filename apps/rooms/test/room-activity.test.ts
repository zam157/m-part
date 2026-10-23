import type { ClientMessage, RoomSnapshot, ServerMessage } from '@m-part/listen-core/protocol'
import { LISTEN_PROTOCOL, ROOM_HISTORY_LIMIT, clientMessage, serverMessage } from '@m-part/listen-core/protocol'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import * as v from 'valibot'
import { ListenRooms } from '../server/utils/listen-rooms'

const song = (id: string) => ({ provider: 'netease' as const, id, title: `Song ${id}`, duration: 120, coverUrl: '' })
const peer = (id: string) => ({ id, messages: [] as ServerMessage[], send(message: ServerMessage) { this.messages.push(structuredClone(message)) }, close: vi.fn() })
let rooms: ListenRooms
let now: number
let host: ReturnType<typeof peer>
let member: ReturnType<typeof peer>
let other: ReturnType<typeof peer>
const state = (p = host) => (p.messages.findLast(m => m.type === 'snapshot' || m.type === 'welcome') as { snapshot: RoomSnapshot }).snapshot
const welcome = (p: ReturnType<typeof peer>) => p.messages.find(m => m.type === 'welcome') as Extract<ServerMessage, { type: 'welcome' }>
const send = (p: ReturnType<typeof peer>, message: ClientMessage) => rooms.receive(p, v.parse(clientMessage, message))
const role = (target = member, admin = true, actor = host, commandId: string = crypto.randomUUID()) => send(actor, { type: 'role', commandId, memberId: welcome(target).memberId, role: admin ? 'admin' : 'member' })
const command = (actor: ReturnType<typeof peer>, action: Extract<ClientMessage, { type: 'command' }>['action'], extra = {}) => send(actor, { type: 'command', commandId: crypto.randomUUID(), expectedRevision: state(actor).revision, action, ...extra })
const chat = (p = member, text = '一起听吧', commandId: string = crypto.randomUUID()) => send(p, { type: 'chat', commandId, text })

beforeEach(() => {
  now = 0; rooms = new ListenRooms(() => now, undefined, () => 1_800_000_000_000 + now)
  host = peer('host'); member = peer('member'); other = peer('other')
  send(host, { type: 'create', protocol: LISTEN_PROTOCOL, kind: 'music', name: '房主', tracks: [song('1'), song('2')] })
  for (const p of [member, other]) send(p, { type: 'join', protocol: LISTEN_PROTOCOL, kind: 'music', name: p.id, code: state().code })
})

describe('room administrator authority', () => {
  it('only the host grants/revokes roles and authorization does not touch the playback timeline', () => {
    const before = state()
    role(member, true, member)
    expect(member.messages.at(-1)).toMatchObject({ type: 'error', code: 'host-only' })
    role()
    expect(state().members.find(m => m.id === welcome(member).memberId)?.role).toBe('admin')
    expect(state()).toMatchObject({ revision: before.revision, playbackId: before.playbackId, status: before.status, positionAtAnchor: before.positionAtAnchor })
    expect(state().history.at(-1)).toMatchObject({ name: '房主', kind: 'operation', text: '授权「member」为管理员' })
    role(other, true, member)
    expect(state().members.find(m => m.id === welcome(other).memberId)?.role).toBe('member')
    role(member, false)
    command(member, 'next')
    expect(member.messages.at(-1)).toMatchObject({ type: 'error', code: 'host-only' })
  })
  it('permits administrator queue/play/pause/seek/mode controls but keeps automatic ended and credentials host-only', () => {
    role()
    command(member, 'add-next', { track: song('3') })
    command(member, 'next')
    expect(state().queue[state().currentIndex!]!.id).toBe('3')
    command(member, 'play'); command(member, 'pause'); command(member, 'seek', { position: 45 }); command(member, 'mode', { mode: 'loop' })
    expect(state()).toMatchObject({ status: 'paused', positionAtAnchor: 45, playMode: 'loop' })
    const before = state().revision
    command(member, 'ended')
    expect(state().revision).toBe(before)
    expect(() => rooms.updateSource(welcome(member).token, state().roomId, before, { mode: 'hosted' })).toThrow('仅房主')
    expect(state().history.some(entry => entry.name === 'member' && entry.text === '将进度调整至 0:45')).toBe(true)
    send(member, { type: 'report', revision: before, playbackId: state().playbackId, status: 'failed' })
    expect(state().revision).toBe(before)
  })
  it('keeps grants across resume, revokes offline identities, and prevents a new member inheriting a role', () => {
    role(); const identity = welcome(member)
    rooms.disconnect(member.id)
    const resumed = peer('resumed')
    send(resumed, { type: 'resume', protocol: LISTEN_PROTOCOL, token: identity.token })
    expect(state(resumed).members.find(m => m.id === identity.memberId)?.role).toBe('admin')
    rooms.disconnect(resumed.id)
    role(member, false)
    const again = peer('again')
    send(again, { type: 'resume', protocol: LISTEN_PROTOCOL, token: identity.token })
    expect(state(again).members.find(m => m.id === identity.memberId)?.role).toBe('member')
    send(again, { type: 'leave' })
    const newcomer = peer('newcomer')
    send(newcomer, { type: 'join', protocol: LISTEN_PROTOCOL, kind: 'music', name: 'member', code: state().code })
    expect(state(newcomer).members.find(m => m.id === welcome(newcomer).memberId)?.role).toBe('member')
  })
  it('deduplicates role changes and rejects host/self promotion or a member from another room', () => {
    role(member, true, host, 'grant-once'); const count = state().history.length
    role(member, true, host, 'grant-once')
    expect(state().history).toHaveLength(count)
    role(host)
    expect(host.messages.at(-1)).toMatchObject({ type: 'error', code: 'invalid' })
    send(host, { type: 'role', commandId: 'missing', memberId: 'another-room-member', role: 'admin' })
    expect(host.messages.at(-1)).toMatchObject({ type: 'error', code: 'invalid' })
    expect(v.safeParse(clientMessage, { type: 'join', protocol: LISTEN_PROTOCOL, name: 'fake', code: state().code, role: 'admin' }).success).toBe(false)
  })
  it('freezes administrator playback controls during host disconnect while keeping chat available', () => {
    role(); const before = state().revision
    rooms.disconnect(host.id)
    command(member, 'next')
    expect(member.messages.at(-1)).toMatchObject({ type: 'error', code: 'host-offline' })
    expect(state(member).revision).toBe(before)
    chat(member, '等待房主回来')
    expect(state(member).history.at(-1)?.text).toBe('等待房主回来')
    const resumed = peer('host-resumed')
    send(resumed, { type: 'resume', protocol: LISTEN_PROTOCOL, token: welcome(host).token })
    command(member, 'next')
    expect(state(member).revision).toBeGreaterThan(before)
  })
})

describe('room chat and operation history', () => {
  it('binds authors and times on the server, deduplicates chat, and does not change playback revision', () => {
    const before = state()
    chat(member, '  <img src=x onerror=evil()>你好  ', 'chat-once')
    chat(member, '  <img src=x onerror=evil()>你好  ', 'chat-once')
    expect(state().history.filter(e => e.kind === 'chat')).toHaveLength(1)
    expect(state().history.at(-1)).toMatchObject({ name: 'member', memberId: welcome(member).memberId, at: 1_800_000_000_000, text: '<img src=x onerror=evil()>你好' })
    expect(state().revision).toBe(before.revision)
    expect(state().playbackId).toBe(before.playbackId)
    expect(state(other).history).toEqual(state().history)
    for (const message of other.messages) expect(v.safeParse(serverMessage, message).success).toBe(true)
    expect(v.safeParse(clientMessage, { type: 'chat', commandId: 'fake', text: 'hi', name: '房主' }).success).toBe(false)
  })
  it('bounds chat, rate-limits floods, and lets ordinary members chat without granting playback control', () => {
    for (const text of ['', ' \n ', 'x'.repeat(501)]) expect(v.safeParse(clientMessage, { type: 'chat', commandId: 'bad', text }).success).toBe(false)
    for (let i = 0; i < 9; i++) chat()
    expect(member.messages.at(-1)).toMatchObject({ type: 'error', code: 'rate-limit' })
    expect(state().history.filter(e => e.kind === 'chat')).toHaveLength(8)
    command(member, 'pause')
    expect(member.messages.at(-1)).toMatchObject({ type: 'error', code: 'host-only' })
    now += 10_000; chat()
    expect(state().history.filter(e => e.kind === 'chat')).toHaveLength(9)
  })
  it('keeps only the latest 200 entries, sends them to late joins/resumes, and does not record heartbeats or readiness', () => {
    for (let i = 0; i < 220; i++) {
      if (i % 5 === 0) { now += 10_000; for (const p of [host, member, other]) send(p, { type: 'ping', sentAt: now }) }
      chat(member, `message-${i}`)
    }
    expect(state().history).toHaveLength(ROOM_HISTORY_LIMIT)
    expect(state().history[0]?.text).toBe('message-20')
    const before = state().history.length
    send(host, { type: 'report', revision: state().revision, playbackId: state().playbackId, status: 'ready' })
    send(host, { type: 'ping', sentAt: now })
    expect(state().history).toHaveLength(before)
    const late = peer('late')
    send(late, { type: 'join', protocol: LISTEN_PROTOCOL, kind: 'music', name: 'Late', code: state().code })
    expect(state(late).history.at(-2)?.text).toBe('message-219')
    const resumed = peer('resumed')
    send(resumed, { type: 'resume', protocol: LISTEN_PROTOCOL, token: welcome(late).token })
    expect(state(resumed).history.at(-3)?.text).toBe('message-219')
  })
  it('records accepted controls once, not rejected commands; never copies hosted secrets into history', () => {
    command(host, 'pause')
    const id = 'once'; const revision = state().revision
    send(host, { type: 'command', commandId: id, expectedRevision: revision, action: 'next' })
    const count = state().history.length
    send(host, { type: 'command', commandId: id, expectedRevision: revision, action: 'next' })
    command(member, 'pause')
    expect(state().history).toHaveLength(count)
    rooms.updateSource(welcome(host).token, state().roomId, state().revision, { credential: 'ready', label: 'Safe label', mode: 'hosted' })
    rooms.sourceFailed(state().roomId, state().source!.version, 'https://private.example/signed?token=private')
    expect(JSON.stringify(state().history)).not.toContain('private.example')
    expect(state().history.at(-1)?.text).toBe('房间托管音源不可用，已暂停播放')
  })
})
