import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import * as v from 'valibot'
import { signListenAccount, verifyListenAccount } from '@m-part/listen-core/account-proof'
import type { ListenAccount } from '@m-part/listen-core/account-proof'
import { clientMessage, DISCONNECT_GRACE_MS, LISTEN_PROTOCOL, serverMessage } from '@m-part/listen-core/protocol'
import type { ClientMessage, ServerMessage } from '@m-part/listen-core/protocol'
import { ListenRooms } from '../server/utils/listen-rooms'
import { openRoomStorage } from '../server/utils/room-storage'

const config = { audience: 'https://rooms.example.test', secret: 'test-secret-for-room-account-pairing' }
const owner = { id: 'owner-id', username: 'owner' }
const admin = { id: 'admin-id', username: 'listener' }
const song = { provider: 'bili' as const, id: 'BV123:12', title: 'Song', duration: 90, coverUrl: '' }
const peer = (id: string) => ({
  id, messages: [] as ServerMessage[], closed: false,
  send(message: ServerMessage) { this.messages.push(v.parse(serverMessage, structuredClone(message))) },
  close() { this.closed = true },
})
type Peer = ReturnType<typeof peer>
type Welcome = Extract<ServerMessage, { type: 'welcome' }>
const welcome = (peer: Peer) => peer.messages.findLast((message): message is Welcome => message.type === 'welcome')!
const state = (peer: Peer) => peer.messages.findLast(message => message.type === 'snapshot' || message.type === 'welcome')!.snapshot

describe('account-owned rooms with SQLite', () => {
  let now: number
  let directory: string
  let storage: ReturnType<typeof openRoomStorage>
  let rooms: ListenRooms

  function open() {
    storage = openRoomStorage(join(directory, 'rooms.sqlite'))
    rooms = new ListenRooms(() => now, undefined, () => now, { storage: () => storage, verify: token => verifyListenAccount(config, token, now) })
  }
  function restart() { storage.close(); open() }
  function send(peer: Peer, message: ClientMessage) { rooms.receive(peer, v.parse(clientMessage, message)) }
  function proof(account: ListenAccount) { return signListenAccount(config, account, now) }
  function create(peer: Peer, accountProof = proof(owner)) {
    send(peer, { type: 'create', kind: 'music', protocol: LISTEN_PROTOCOL, name: '房主', tracks: [song], position: 24, accountProof })
  }
  function joinRoom(peer: Peer, code: string, name: string, account?: ListenAccount) {
    send(peer, { type: 'join', kind: 'music', protocol: LISTEN_PROTOCOL, code, name, accountProof: account && proof(account) })
  }

  beforeEach(() => {
    now = 0
    directory = mkdtempSync(join(tmpdir(), 'mpart-rooms-test-'))
    open()
  })
  afterEach(() => { storage.close(); rmSync(directory, { recursive: true, force: true }) })

  it('keeps the room and account grants through exit, expiry and service restart', () => {
    const host = peer('host')
    const member = peer('member')
    create(host)
    const { code, roomId, hostId } = state(host)
    joinRoom(member, code, '客人', admin)
    const memberId = welcome(member).memberId
    send(host, { type: 'role', commandId: 'grant', memberId, role: 'admin' })
    rooms.updateSource(welcome(host).token, roomId, state(host).revision, { modes: { bili: 'independent' } })
    send(member, { type: 'leave' })
    send(host, { type: 'leave' })
    expect(rooms.hasRooms).toBe(false)
    now += 24 * 60 * 60_000
    rooms.sweep()
    restart()
    expect(rooms.roomsForAccount(owner.id)).toEqual([{ code, role: 'host', title: song.title }])
    expect(rooms.roomsForAccount(admin.id)).toEqual([{ code, role: 'admin', title: song.title }])
    expect(rooms.roomsForAccount('unknown')).toEqual([])

    const guest = peer('guest')
    joinRoom(guest, code, '客人')
    expect(state(guest)).toMatchObject({ code, roomId, hostId, persistent: true, status: 'paused', wantsToPlay: false, positionAtAnchor: 24, source: { mode: 'independent', credential: 'none' } })
    expect(state(guest).members[0]).toMatchObject({ role: 'member' })
    expect(JSON.stringify(state(guest))).not.toContain(admin.id)
    const returning = peer('returning-admin')
    joinRoom(returning, code, '换了昵称', admin)
    expect(welcome(returning)).toMatchObject({ memberId, accountBound: true })
    expect(state(returning).members.find(member => member.id === memberId)).toMatchObject({ role: 'admin', accountName: admin.username })

    const returningHost = peer('returning-host')
    joinRoom(returningHost, code, '另一个昵称', owner)
    expect(welcome(returningHost).memberId).toBe(hostId)
    send(returning, { type: 'command', commandId: 'seek', action: 'seek', position: 32, expectedRevision: state(returning).revision })
    expect(state(returningHost).positionAtAnchor).toBe(32)

    send(returning, { type: 'leave' })
    send(returningHost, { type: 'role', commandId: 'revoke', memberId, role: 'member' })
    restart()
    const revoked = peer('revoked')
    joinRoom(revoked, code, '客人', admin)
    expect(state(revoked).members[0]).toMatchObject({ role: 'member' })
    expect(rooms.roomsForAccount(admin.id)).toEqual([])
  })

  it('requires the same account for resume and reserves a place for the owner', () => {
    const host = peer('host')
    create(host)
    const { code } = state(host)
    const { token, memberId } = welcome(host)
    rooms.disconnect(host.id)
    now += DISCONNECT_GRACE_MS
    rooms.sweep()
    const other = peer('other')
    send(other, { type: 'resume', protocol: LISTEN_PROTOCOL, token, accountProof: proof(admin) })
    expect(other.messages.at(-1)).toMatchObject({ type: 'error', code: 'account' })
    for (let n = 0; n < 4; n++) joinRoom(peer('guest-' + n), code, '访客')
    const fifth = peer('fifth')
    joinRoom(fifth, code, '访客')
    expect(fifth.messages.at(-1)).toMatchObject({ type: 'error', code: 'capacity' })

    const recovered = peer('recovered')
    send(recovered, { type: 'resume', protocol: LISTEN_PROTOCOL, token, accountProof: proof(owner) })
    expect(welcome(recovered).memberId).toBe(memberId)
    expect(state(recovered).members).toHaveLength(5)
    const outsider = peer('outsider')
    joinRoom(outsider, code, '冒用房主', owner)
    expect(outsider.messages.at(-1)).toMatchObject({ type: 'error', code: 'already-joined' })
  })

  it('rejects an invalid proof and permanently deletes a room only on an owner command', () => {
    const bad = peer('bad')
    const expired = proof(owner)
    now += 31_000
    create(bad, expired)
    expect(bad.messages.at(-1)).toMatchObject({ type: 'error', code: 'account' })
    create(bad, signListenAccount({ ...config, audience: 'https://elsewhere.test' }, owner, now))
    expect(bad.messages.at(-1)).toMatchObject({ type: 'error', code: 'account' })
    create(bad, proof(owner).replace(/^./, 'x'))
    expect(bad.messages.at(-1)).toMatchObject({ type: 'error', code: 'account' })

    const host = peer('host')
    const guest = peer('guest')
    create(host)
    const { code } = state(host)
    joinRoom(guest, code, '客人', admin)
    send(guest, { type: 'end-room', commandId: 'bad-end' })
    expect(guest.messages.at(-1)).toMatchObject({ type: 'error', code: 'host-only' })
    send(host, { type: 'end-room', commandId: 'end' })
    expect(state(guest).status).toBe('ended')
    expect(guest.closed).toBe(true)
    restart()
    const returning = peer('returning')
    joinRoom(returning, code, '房主', owner)
    expect(returning.messages.at(-1)).toMatchObject({ type: 'error', code: 'not-found' })
    expect(rooms.roomsForAccount(owner.id)).toEqual([])
  })
})
