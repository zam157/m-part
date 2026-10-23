import type { PlayerCache } from '~/utils/player-storage'
import type { MusicInfo } from '@m-part/music/types/music-info'
import type { RoomIdentity } from '~/utils/listen-client'
import type { MemberStatus, RoomSnapshot } from '@m-part/listen-core/protocol'
import { createSignal } from 'solid-js'
import { TARGET_EXTENSION } from '@m-part/music/constants'
import { LISTEN_PROTOCOL } from '@m-part/listen-core/protocol'
import { ListenClient, publicTrack } from '~/utils/listen-client'
import { normalizeRoomServer } from '~/utils/listen-server'
import { applyRoomQueue, audio, cancelRoomSource, currentIndex, currentTime, loadRoomSource, playQueue, resetPlayer, restorePlayerSession } from './player'
import { isRoomPlayer, roomPlayerActive, setRoomControlsWritable, setRoomPlayerHandler } from './player-context'
import { savePersonalPlayerSession } from './player-persistence'

const IDENTITY_KEY = 'm-part:listen-room:v1'
export const [roomServer, setRoomServer] = createSignal(localStorage.getItem('m-part:room-server') || import.meta.env.VITE_ROOM_SERVER_URL || 'http://127.0.0.1:3410')
export const [roomView, setRoomView] = createSignal<{
  snapshot?: RoomSnapshot, memberId?: string, connection: string, status: MemberStatus, error: string, away: boolean, inSync: boolean, isHost: boolean,
}>({ connection: 'idle', status: 'loading', error: '', away: false, inSync: false, isHost: false })
export const [joiningRoom, setJoiningRoom] = createSignal(false)
export { roomPlayerActive }
let joining = false
let client: ListenClient | undefined
let backup: PlayerCache | undefined
let unregisterRoom: (() => boolean) | undefined
let setupVersion = 0

function identity(value?: RoomIdentity) {
  if (value) sessionStorage.setItem(IDENTITY_KEY, JSON.stringify(value))
  else sessionStorage.removeItem(IDENTITY_KEY)
}
function update() {
  if (!client) return
  setRoomControlsWritable(client.connection === 'connected' && client.isHost)
  setRoomView({ snapshot: client.connection === 'idle' ? undefined : client.snapshot, memberId: client.memberId, connection: client.connection, status: client.status,
    error: client.error, away: client.away, inSync: client.inSync, isHost: client.connection !== 'idle' && client.isHost })
}
function exit() {
  const released = unregisterRoom?.() ?? !isRoomPlayer()
  unregisterRoom = undefined
  if (released && backup) restorePlayerSession(backup)
  backup = undefined
  joining = false; setJoiningRoom(false)
}
export function dismissRoomError() {
  if (client) { client.error = ''; update() }
  else setRoomView(v => ({ ...v, error: '' }))
}

async function setup(server: string, resume = false, cancelled = () => false) {
  if (joining || isRoomPlayer()) throw new Error('请先退出当前房间')
  const version = ++setupVersion
  joining = true; setJoiningRoom(true)
  try {
    // Request in the click's user gesture; no third-party browser credentials are read.
    if (!resume && TARGET_EXTENSION && globalThis.chrome?.permissions) {
      const url = new URL(server)
      if (!await chrome.permissions.request({ origins: [`${url.protocol}//${url.hostname}/*`] })) throw new Error('未授予房间服务器的访问权限')
    }
    const saved = await savePersonalPlayerSession()
    if (cancelled() || version !== setupVersion) throw new Error('房间恢复已取消')
    backup = saved
    const items = backup.queue?.items ?? []
    const selected = currentIndex()
    const time = currentTime()
    client?.dispose()
    const cache = new Map<string, { signature: string, music: (typeof items)[number] }>()
    client = new ListenClient({
      audio,
      queue(state) {
        const next = new Map<string, { signature: string, music: MusicInfo }>()
        const queue = state.queue.map((track) => {
          const signature = JSON.stringify(track)
          const previous = cache.get(track.queueItemId)
          const entry = previous?.signature === signature ? previous : { signature, music: { ...publicTrack(track) } }
          next.set(track.queueItemId, entry)
          return entry.music
        })
        cache.clear(); for (const [key, value] of next) cache.set(key, value)
        applyRoomQueue(queue, state.currentIndex, state.playMode)
      },
      load: (track, index, signal, quality) => loadRoomSource(track, index, signal, quality),
      cancelLoad: cancelRoomSource,
      empty: resetPlayer,
    }, update, identity, exit)
    unregisterRoom = setRoomPlayerHandler(action => client?.control(action))
    cancelRoomSource()
    localStorage.setItem('m-part:room-server', server)
    setRoomServer(server)
    update()
    return { client, items, selected, time }
  }
  catch (error) { if (version === setupVersion) exit(); throw error }
  finally { if (version === setupVersion) { joining = false; setJoiningRoom(false) } }
}

export async function createListenRoom(serverInput: string, name: string) {
  try {
    const server = normalizeRoomServer(serverInput)
    if (playQueue().length > 1_000) throw new Error('房间最多支持 1000 首歌曲，请先缩减当前队列')
    const prepared = await setup(server)
    prepared.client.open(server, { type: 'create', kind: 'music', protocol: LISTEN_PROTOCOL, name: name.trim().slice(0, 80) || '房主',
      tracks: prepared.items.slice(0, 1_000).map(publicTrack), index: prepared.selected ?? 0, position: prepared.time, autoplay: prepared.items.length > 0,
    })
  }
  catch (error) { setRoomView(v => ({ ...v, error: error instanceof Error ? error.message : String(error) })) }
}
export async function joinListenRoom(serverInput: string, name: string, code: string) {
  try {
    if (!/^[\dA-F]{8}$/i.test(code.trim())) throw new Error('请输入 8 位房间码')
    const server = normalizeRoomServer(serverInput)
    const prepared = await setup(server)
    prepared.client.open(server, { type: 'join', kind: 'music', protocol: LISTEN_PROTOCOL, name: name.trim().slice(0, 80) || '听众', code: code.trim() })
  }
  catch (error) { setRoomView(v => ({ ...v, error: error instanceof Error ? error.message : String(error) })) }
}
export function leaveListenRoom() { client?.leave() }
export function resumeRoomPlayback() { client?.follow() }
export function pauseRoomLocally() { client?.pauseLocal() }

/** Called once after persistence starts; automatic restoration cannot bypass the personal save. */
export function startListenTogether() {
  let disposed = false
  const onRestore = (event: PageTransitionEvent) => { if (event.persisted) location.reload() }
  window.addEventListener('pageshow', onRestore)
  void (async () => {
    await Promise.resolve()
    try {
      const raw = sessionStorage.getItem(IDENTITY_KEY)
      if (!raw) return
      const saved = JSON.parse(raw) as RoomIdentity
      const server = normalizeRoomServer(saved.server)
      if (typeof saved.token !== 'string' || typeof saved.roomId !== 'string') { identity(); return }
      const prepared = await setup(server, true, () => disposed)
      if (disposed) { prepared.client.dispose(); exit(); return }
      await prepared.client.resume(saved)
    }
    catch (error) { if (!disposed) { identity(); exit(); setRoomView(v => ({ ...v, error: error instanceof Error ? error.message : String(error) })) } }
  })()
  return () => { disposed = true; setupVersion++; window.removeEventListener('pageshow', onRestore); client?.dispose(); exit() }
}
