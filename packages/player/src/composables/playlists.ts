import type { PlaylistInfo } from '@m-part/music/types/music-info'
import type { ProviderName, ProviderUser } from '@m-part/music/types/provider'
import { errorMessage } from '../utils/index'
import { providers } from '@m-part/music/providers'
import { LoginRequiredError } from '@m-part/music/providers/login-required'
import { createSignal, untrack } from 'solid-js'

interface LibraryState {
  source: ProviderName
  user: ProviderUser | null
  items: PlaylistInfo[]
  page: number
  hasMore: boolean
  loading: boolean
  loaded: boolean
  error: string | null
}

function emptyLibrary(source: ProviderName): LibraryState {
  return { source, user: null, items: [], page: 0, hasMore: false, loading: false, loaded: false, error: null }
}

export const [playlistSource, setPlaylistSource] = createSignal<ProviderName>('bili')
const [playlistLibrary, setPlaylistLibrary] = createSignal<LibraryState>(emptyLibrary('bili'))
export { playlistLibrary }

let revision = 0
let pending: Promise<void> | undefined
let pendingSource: ProviderName | undefined

export function loadPlaylists(source: ProviderName, options: { refresh?: boolean, more?: boolean } = {}): Promise<void> {
  if (pending && pendingSource === source)
    return pending
  if (pending && pendingSource !== source) {
    ++revision
    pending = undefined
    pendingSource = undefined
  }
  const previous = untrack(playlistLibrary)
  if (!options.refresh && !options.more && previous.source === source && previous.loaded)
    return Promise.resolve()
  const append = options.more && previous.source === source && previous.user && previous.hasMore
  if (options.more && !append)
    return Promise.resolve()
  const requestRevision = ++revision
  pendingSource = source
  const task = (async () => {
    await Promise.resolve()
    if (requestRevision !== revision)
      return
    setPlaylistLibrary({ ...(append ? previous : emptyLibrary(source)), loading: true })
    try {
      const provider = providers[source]
      if (!provider.getCurrentUser || !provider.getPlaylists)
        throw new Error('当前音源暂不支持收藏歌单')
      // 刷新时重新识别账号，避免切换账号后继续展示上一个人的收藏。
      const user = append ? previous.user : await provider.getCurrentUser()
      if (requestRevision !== revision)
        return
      if (!user) {
        setPlaylistLibrary({ ...emptyLibrary(source), loaded: true })
        return
      }
      const page = append ? previous.page + 1 : 1
      const result = await provider.getPlaylists(user.id, page)
      if (requestRevision !== revision)
        return
      const items = [...new Map([...(append ? previous.items : []), ...result.items].map(item => [item.id, item])).values()]
      setPlaylistLibrary({ source, user, items, page, hasMore: result.hasMore, loading: false, loaded: true, error: null })
    }
    catch (error) {
      if (requestRevision !== revision)
        return
      if (error instanceof LoginRequiredError)
        setPlaylistLibrary({ ...emptyLibrary(source), loaded: true })
      else
        setPlaylistLibrary(state => ({ ...state, loading: false, error: errorMessage(error) }))
    }
    finally {
      if (requestRevision === revision) {
        pending = undefined
        pendingSource = undefined
      }
    }
  })()
  pending = task
  return task
}
