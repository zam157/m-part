import type { MusicInfo } from '@m-part/music/types/music-info'
import type { ProviderName } from '@m-part/music/types/provider'
import { errorMessage } from '../utils/index'
import { providers } from '@m-part/music/providers'
import { LoginRequiredError } from '@m-part/music/providers/login-required'
import { createSignal, untrack } from 'solid-js'

export function createPlaylistTracks(source: ProviderName, id: string) {
  const [state, setState] = createSignal({
    items: [] as MusicInfo[], page: 0, hasMore: false, loading: true, error: null as string | null, loginRequired: false,
  })
  let revision = 0
  let disposed = false
  let pending: Promise<ReturnType<typeof state> | undefined> | undefined
  let allPending: Promise<MusicInfo[] | null> | undefined
  let allController: AbortController | undefined
  const [loadingAll, setLoadingAll] = createSignal(false)

  function load(refresh = false): Promise<ReturnType<typeof state> | undefined> {
    if (disposed || refresh && allPending)
      return Promise.resolve(undefined)
    if (pending)
      return pending
    const previous = untrack(state)
    const page = refresh ? 1 : previous.page + 1
    const requestRevision = ++revision
    const task = (async () => {
      await Promise.resolve()
      if (requestRevision !== revision)
        return
      setState({ ...previous, ...(refresh ? { items: [], page: 0 } : {}), loading: true, error: null, loginRequired: false })
      try {
        const provider = providers[source]
        if (!provider.getPlaylist)
          throw new Error('当前音源暂不支持歌单曲目')
        const result = await provider.getPlaylist(id, page)
        if (requestRevision !== revision)
          return
        const items = [...new Map([...(refresh ? [] : previous.items), ...result.items].map(item => [item.id, item])).values()]
        const next = { items, page, hasMore: result.hasMore, loading: false, error: null, loginRequired: false }
        setState(next)
        return next
      }
      catch (error) {
        if (requestRevision !== revision)
          return
        if (error instanceof LoginRequiredError)
          setState({ items: [], page: 0, hasMore: false, loading: false, error: null, loginRequired: true })
        else
          setState(current => ({ ...current, loading: false, error: errorMessage(error) }))
      }
      finally {
        if (requestRevision === revision)
          pending = undefined
      }
    })()
    pending = task
    return task
  }

  function loadAll(): Promise<MusicInfo[] | null> {
    if (disposed)
      return Promise.resolve(null)
    if (allPending)
      return allPending
    const task = (async () => {
      await Promise.resolve()
      if (disposed)
        return null
      setLoadingAll(true)
      try {
        // 使用每页显式返回的快照，避免 Solid 2 暂存写入导致重复读取上一页。
        let current = untrack(state)
        if (pending) {
          const loaded = await pending
          if (!loaded || disposed)
            return null
          current = loaded
        }
        if (current.loginRequired)
          return null
        const provider = providers[source]
        if (provider.getAllPlaylistTracks && (current.page === 0 || current.hasMore || current.error)) {
          allController = new AbortController()
          setState({ ...current, loading: true, error: null })
          const items = await provider.getAllPlaylistTracks(id, {
            signal: allController.signal,
            knownItems: current.items,
            onProgress: (progress) => {
              if (!disposed)
                setState(value => ({ ...value, items: progress.items, hasMore: true }))
            },
          })
          if (disposed)
            return null
          const unique = [...new Map(items.map(item => [item.id, item])).values()]
          setState({ items: unique, page: current.page || 1, hasMore: false, loading: false, error: null, loginRequired: false })
          return unique
        }
        if (current.page === 0 || current.error) {
          const loaded = await load()
          if (!loaded || disposed)
            return null
          current = loaded
        }
        while (current.hasMore) {
          const loaded = await load()
          if (!loaded || disposed)
            return null
          current = loaded
        }
        return current.items
      }
      catch (error) {
        if (!disposed) {
          if (error instanceof LoginRequiredError)
            setState({ items: [], page: 0, hasMore: false, loading: false, error: null, loginRequired: true })
          else
            setState(value => ({ ...value, loading: false, error: errorMessage(error) }))
        }
        return null
      }
      finally {
        if (!disposed)
          setLoadingAll(false)
        allPending = undefined
        allController = undefined
      }
    })()
    allPending = task
    return task
  }

  return { state, load, loadAll, loadingAll, dispose: () => { disposed = true; ++revision; allController?.abort() } }
}
