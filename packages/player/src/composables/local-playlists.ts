import type { MusicInfo } from '@m-part/music/types/music-info'
import { createSignal, untrack } from 'solid-js'
import type { LocalPlaylist, LocalPlaylistStorage } from '~/utils/local-playlist-storage'
import { createLocalPlaylistStorage, localPlaylistTitle, localPlaylistTracks } from '~/utils/local-playlist-storage'
import { errorMessage } from '~/utils/index'

export function createLocalPlaylistLibrary(storage: LocalPlaylistStorage = createLocalPlaylistStorage()) {
  const [state, setState] = createSignal({ items: [] as LocalPlaylist[], loaded: false, loading: false, error: '' })
  let pending: Promise<unknown> = Promise.resolve()
  function run<T>(operation: () => Promise<{ items: LocalPlaylist[], value: T }>): Promise<T> {
    const task = pending.then(async () => {
      setState(previous => ({ ...previous, loading: true, error: '' }))
      try {
        const result = await operation()
        setState({ items: result.items, loaded: true, loading: false, error: '' })
        return result.value
      }
      catch (error) {
        setState(previous => ({ ...previous, loading: false, error: errorMessage(error) }))
        throw error
      }
    })
    pending = task.catch(() => {})
    return task
  }
  return {
    state,
    async load(refresh = false) {
      if (!refresh && untrack(state).loaded) return
      try { await run(async () => ({ items: await storage.read(), value: undefined })) }
      catch { /* The state exposes a retryable storage error. */ }
    },
    create(title: string, tracks: MusicInfo[] = []) {
      return run(async () => {
        const id = crypto.randomUUID()
        const now = Date.now()
        const playlist: LocalPlaylist = { id, title: localPlaylistTitle(title), tracks: localPlaylistTracks(tracks), createdAt: now, updatedAt: now }
        const items = await storage.update(id, () => playlist)
        return { items, value: playlist }
      })
    },
    change(id: string, update: (playlist: LocalPlaylist) => LocalPlaylist | undefined) {
      return run(async () => ({
        items: await storage.update(id, current => {
          if (!current) throw new Error('这个本地歌单已被删除，请刷新后重试')
          const next = update(current)
          return next ? { ...next, title: localPlaylistTitle(next.title), tracks: localPlaylistTracks(next.tracks), updatedAt: Date.now() } : undefined
        }), value: undefined,
      }))
    },
    close: storage.close,
  }
}

export const localPlaylists = createLocalPlaylistLibrary()
import.meta.hot?.dispose(() => localPlaylists.close())
export type LocalPlaylistDialogRequest =
  | { kind: 'create' }
  | { kind: 'add', music: MusicInfo }
  | { kind: 'rename' | 'delete', id: string, title: string }
export const [localPlaylistDialog, setLocalPlaylistDialog] = createSignal<LocalPlaylistDialogRequest | null>(null)
export function addMusicToLocalPlaylist(id: string, music: MusicInfo) {
  return localPlaylists.change(id, playlist => ({ ...playlist, tracks: [...playlist.tracks, music] }))
}
