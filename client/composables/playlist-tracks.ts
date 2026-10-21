import type { MusicInfo } from '#shared/types/music-info'
import type { ProviderName } from '#shared/types/provider'
import { errorMessage } from '#shared/utils'
import { providers } from '#shared/utils/providers/index'
import { LoginRequiredError } from '#shared/utils/providers/login-required'
import { createSignal, untrack } from 'solid-js'

export function createPlaylistTracks(source: ProviderName, id: string) {
  const [state, setState] = createSignal({
    items: [] as MusicInfo[], page: 0, hasMore: false, loading: true, error: null as string | null, loginRequired: false,
  })
  let revision = 0
  let pending: Promise<void> | undefined

  function load(refresh = false): Promise<void> {
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
        setState({ items, page, hasMore: result.hasMore, loading: false, error: null, loginRequired: false })
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

  return { state, load, dispose: () => { ++revision } }
}
