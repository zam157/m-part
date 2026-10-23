import type { MusicInfo } from '@m-part/music/types/music-info'
import type { PlayMode } from '~/composables/player'

export interface StoredQueue {
  items: MusicInfo[]
  playMode: PlayMode
  randomOrder: number[] | null
}
export interface StoredPosition {
  song: { provider: MusicInfo['provider'], id: string } | null
  time: number
}
export interface PlayerCache {
  queue?: StoredQueue
  position?: StoredPosition
  volume?: number
}
export interface PlayerStorage {
  read: () => Promise<PlayerCache>
  write: (patch: PlayerCache) => Promise<void>
  close: () => void
}

/** 只缓存曲目资料；音频 URL 可能签名过期或是本次会话的 blob URL。 */
export function queueForStorage(items: MusicInfo[], playMode: PlayMode, randomOrder: number[] | null): StoredQueue {
  return {
    items: items.map(song => ({
      provider: song.provider, id: song.id, title: song.title, duration: song.duration,
      coverUrl: song.coverUrl, artist: song.artist, album: song.album, description: song.description,
    })),
    playMode,
    randomOrder,
  }
}

function record(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : undefined
}
function identity(value: unknown): StoredPosition['song'] {
  const row = record(value)
  return row && (row.provider === 'bili' || row.provider === 'netease' || row.provider === 'qq') && typeof row.id === 'string' && row.id
    ? { provider: row.provider, id: row.id }
    : null
}

/** 旧缓存、异常值不能让播放器启动失败；身份字段用于过滤并定位当前歌曲。 */
export function decodePlayerCache(value: unknown): PlayerCache {
  const raw = record(value)
  if (!raw)
    return {}
  const result: PlayerCache = {}
  if (typeof raw.volume === 'number' && Number.isFinite(raw.volume))
    result.volume = Math.max(0, Math.min(1, raw.volume))
  const queue = record(raw.queue)
  if (queue && Array.isArray(queue.items)) {
    const seen = new Set<string>()
    const items: MusicInfo[] = []
    for (const value of queue.items) {
      const row = record(value)
      const song = identity(value)
      if (!row || !song || typeof row.title !== 'string')
        continue
      const key = `${song.provider}:${song.id}`
      if (seen.has(key))
        continue
      seen.add(key)
      items.push({
        ...song, title: row.title,
        duration: typeof row.duration === 'number' && Number.isFinite(row.duration) ? Math.max(0, row.duration) : 0,
        coverUrl: typeof row.coverUrl === 'string' ? row.coverUrl : '',
        artist: typeof row.artist === 'string' ? row.artist : undefined,
        album: typeof row.album === 'string' ? row.album : undefined,
        description: typeof row.description === 'string' ? row.description : undefined,
      })
    }
    const order = queue.randomOrder
    const validOrder = Array.isArray(order) && items.length === queue.items.length && order.length === items.length
      && new Set(order).size === items.length && order.every(index => Number.isInteger(index) && index >= 0 && index < items.length)
    result.queue = {
      items,
      playMode: ['order', 'loop', 'random', 'single-loop'].includes(queue.playMode as string) ? queue.playMode as PlayMode : 'order',
      randomOrder: validOrder ? order : null,
    }
  }
  const position = record(raw.position)
  if (position) {
    result.position = {
      song: identity(position.song),
      time: typeof position.time === 'number' && Number.isFinite(position.time) ? Math.max(0, position.time) : 0,
    }
  }
  return result
}

const DATABASE = 'mpart-player'
const STORE = 'state'

/** 一个长连接，启动时一次读取；增量写入以同一事务提交，避免队列和进度错配。 */
export function createPlayerStorage(): PlayerStorage {
  let connection: Promise<IDBDatabase> | undefined
  let closed = false
  function open(): Promise<IDBDatabase> {
    if (closed)
      return Promise.reject(new Error('播放器缓存已关闭'))
    if (connection)
      return connection
    connection = new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open(DATABASE, 1)
      let failed = false
      request.onupgradeneeded = () => request.result.createObjectStore(STORE)
      request.onerror = () => { failed = true; reject(request.error) }
      request.onblocked = () => { failed = true; reject(new Error('播放器缓存升级被其他页面占用')) }
      request.onsuccess = () => {
        const db = request.result
        if (failed || closed) {
          db.close()
          reject(new Error('播放器缓存连接已关闭'))
          return
        }
        db.onversionchange = () => { db.close(); connection = undefined }
        db.onclose = () => { connection = undefined }
        resolve(db)
      }
    }).catch((error) => { connection = undefined; throw error })
    return connection
  }
  return {
    async read() {
      const db = await open()
      return new Promise<PlayerCache>((resolve, reject) => {
        const tx = db.transaction(STORE, 'readonly')
        const store = tx.objectStore(STORE)
        const queue = store.get('queue')
        const position = store.get('position')
        const volume = store.get('volume')
        tx.oncomplete = () => resolve(decodePlayerCache({ queue: queue.result, position: position.result, volume: volume.result }))
        tx.onabort = tx.onerror = () => reject(tx.error ?? new Error('读取播放器缓存失败'))
      })
    },
    async write(patch) {
      const db = await open()
      return new Promise<void>((resolve, reject) => {
        const tx = db.transaction(STORE, 'readwrite')
        tx.oncomplete = () => resolve()
        tx.onabort = tx.onerror = () => reject(tx.error ?? new Error('保存播放器缓存失败'))
        const store = tx.objectStore(STORE)
        try {
          for (const [key, value] of Object.entries(patch))
            store.put(value, key)
        }
        catch (error) {
          tx.abort()
          reject(error)
        }
      })
    },
    close() {
      closed = true
      void connection?.then(db => db.close(), () => {})
    },
  }
}

/** 固定窗口合并：连续更新不会无限延后写入，队列只在结构变化时写。 */
export function createPlayerCacheWriter(storage: PlayerStorage, onError: (error: unknown) => void) {
  let pending: PlayerCache = {}
  let timer: ReturnType<typeof setTimeout> | undefined
  let deadline = Infinity
  let writing: Promise<void> | undefined
  let disposed = false

  function schedule(patch: PlayerCache, delay: number) {
    if (disposed)
      return
    Object.assign(pending, patch)
    const next = Date.now() + delay
    if (next >= deadline)
      return
    clearTimeout(timer)
    deadline = next
    timer = setTimeout(() => { void flush() }, delay)
  }
  function flush(): Promise<void> {
    clearTimeout(timer)
    timer = undefined
    deadline = Infinity
    if (disposed)
      return Promise.resolve()
    if (writing)
      return writing.then(flush)
    if (!Object.keys(pending).length)
      return Promise.resolve()
    const patch = pending
    pending = {}
    // 先进入 Promise，兼容同步抛错的适配器；同一时间只有一个写事务。
    writing = Promise.resolve().then(() => storage.write(patch)).catch((error) => {
      onError(error)
      if (!disposed)
        schedule({ ...patch, ...pending }, 5000)
    }).finally(() => { writing = undefined })
    return writing
  }
  return {
    schedule,
    flush,
    dispose() { disposed = true; clearTimeout(timer); pending = {} },
  }
}
