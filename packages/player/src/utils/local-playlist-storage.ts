import type { MusicInfo } from '@m-part/music/types/music-info'
import { decodePlayerCache, queueForStorage } from './player-storage'

export interface LocalPlaylist {
  id: string
  title: string
  tracks: MusicInfo[]
  createdAt: number
  updatedAt: number
}
export interface LocalPlaylistStorage {
  read: () => Promise<LocalPlaylist[]>
  update: (id: string, change: (current: LocalPlaylist | undefined) => LocalPlaylist | undefined) => Promise<LocalPlaylist[]>
  close: () => void
}

export function localPlaylistTitle(value: string) {
  const title = value.trim()
  if (!title) throw new Error('请输入歌单名称')
  if (title.length > 80) throw new Error('歌单名称不能超过 80 个字符')
  return title
}

/** Share the player's metadata allowlist; signed audio URLs and credentials never enter a playlist. */
export function localPlaylistTracks(tracks: MusicInfo[]) {
  return decodePlayerCache({ queue: queueForStorage(tracks, 'order', null) }).queue!.items
}
export function decodeLocalPlaylist(value: unknown): LocalPlaylist | undefined {
  if (!value || typeof value !== 'object') return
  const row = value as Record<string, unknown>
  if (typeof row.id !== 'string' || !row.id || typeof row.title !== 'string' || !row.title.trim() || !Array.isArray(row.tracks)) return
  const tracks = decodePlayerCache({ queue: { items: row.tracks } }).queue!.items
  return {
    id: row.id, title: row.title.trim().slice(0, 80), tracks,
    createdAt: typeof row.createdAt === 'number' && Number.isFinite(row.createdAt) ? row.createdAt : 0,
    updatedAt: typeof row.updatedAt === 'number' && Number.isFinite(row.updatedAt) ? row.updatedAt : 0,
  }
}
function decodeLibrary(rows: unknown[]): LocalPlaylist[] {
  return rows.flatMap(row => { const playlist = decodeLocalPlaylist(row); return playlist ? [playlist] : [] }).sort((a, b) => b.createdAt - a.createdAt || a.id.localeCompare(b.id))
}

/** Read/modify/write in one transaction so concurrent tabs cannot overwrite each other's additions. */
export function createLocalPlaylistStorage(database = 'mpart-local-playlists'): LocalPlaylistStorage {
  let connection: Promise<IDBDatabase> | undefined
  function open() {
    return connection ??= new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open(database, 1)
      let failed = false
      request.onupgradeneeded = () => request.result.createObjectStore('playlists', { keyPath: 'id' })
      request.onerror = () => { failed = true; reject(request.error) }
      request.onblocked = () => { failed = true; reject(new Error('歌单数据库被其他页面占用，请关闭旧页面后重试')) }
      request.onsuccess = () => {
        const db = request.result
        if (failed) { db.close(); return }
        db.onversionchange = () => { db.close(); connection = undefined }
        db.onclose = () => { connection = undefined }
        resolve(db)
      }
    }).catch(error => { connection = undefined; throw error })
  }
  return {
    async read() {
      const db = await open()
      return new Promise<LocalPlaylist[]>((resolve, reject) => {
        const tx = db.transaction('playlists', 'readonly')
        const request = tx.objectStore('playlists').getAll()
        tx.oncomplete = () => resolve(decodeLibrary(request.result))
        tx.onerror = tx.onabort = () => reject(tx.error ?? new Error('读取本地歌单失败'))
      })
    },
    async update(id, change) {
      const db = await open()
      return new Promise<LocalPlaylist[]>((resolve, reject) => {
        const tx = db.transaction('playlists', 'readwrite')
        const store = tx.objectStore('playlists')
        const request = store.get(id)
        let rows: IDBRequest<unknown[]> | undefined
        let failure: unknown
        request.onsuccess = () => {
          try {
            const next = change(decodeLocalPlaylist(request.result))
            if (next) store.put(next)
            else store.delete(id)
            rows = store.getAll()
          }
          catch (error) { failure = error; tx.abort() }
        }
        tx.oncomplete = () => resolve(decodeLibrary(rows!.result))
        tx.onerror = tx.onabort = () => reject(failure ?? tx.error ?? new Error('保存本地歌单失败'))
      })
    },
    close() { void connection?.then(db => db.close(), () => {}); connection = undefined },
  }
}
