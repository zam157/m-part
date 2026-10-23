import type { AlbumInfo, ArtistInfo, MusicInfo, PlaylistInfo } from '@m-part/music/types/music-info'
import type { Pagination, Provider, ProviderName, SearchType } from '@m-part/music/types/provider'
import { errorMessage } from '../utils/index'
import type { Option } from '~/components/Select/type'
import { providers } from '@m-part/music/providers'
import { createMemo, createSignal } from 'solid-js'

/**
 * 搜索页状态提升到模块级单例。
 *
 * Solid Router 没有 KeepAlive，页面组件在离开路由后会被卸载；把状态放在模块作用域
 * 可以让关键词、结果与分页在页面之间往返时保留下来（等价于原来的 keep-alive 行为）。
 */

export const sourceOptions = [
  { label: 'BiliBili', value: 'bili' },
  { label: '网易云', value: 'netease' },
  { label: 'QQ音乐', value: 'qq' },
] as const satisfies Option<ProviderName>[]

export const typeOptions = [
  { label: '歌曲', value: 'music' },
  { label: '专辑', value: 'album' },
  { label: '歌手', value: 'artist' },
  { label: '歌单', value: 'playlist' },
] as const satisfies Option<SearchType>[]

type SourceValue = typeof sourceOptions[number]['value']
type TypeValue = typeof typeOptions[number]['value']

/** 空分页（重置时复用） */
function emptyPagination(): Pagination {
  return { page: 1, total: 0, pageSize: 20 }
}

const [selectedSource, setSelectedSourceState] = createSignal<SourceValue>(sourceOptions[0].value)
let searchRevision = 0
const [selectedType, setSelectedType] = createSignal<TypeValue>(typeOptions[0].value)
const [keyword, setKeyword] = createSignal('')
const [searching, setSearching] = createSignal(false)
const [hasSearched, setHasSearched] = createSignal(false)
/** 上一次搜索的失败原因；为空表示没失败过（或已被下一次搜索清掉） */
const [searchError, setSearchError] = createSignal<string | null>(null)
/** 当前结果所属的搜索类型（可能与所选类型不同，取决于最后一次成功的搜索） */
const [searchType, setSearchType] = createSignal<SearchType>(typeOptions[0].value)
const [pagination, setPagination] = createSignal<Pagination>(emptyPagination())
const [musicResults, setMusicResults] = createSignal<MusicInfo[]>([])
const [artistResults, setArtistResults] = createSignal<ArtistInfo[]>([])
const [albumResults, setAlbumResults] = createSignal<AlbumInfo[]>([])
const [playlistResults, setPlaylistResults] = createSignal<PlaylistInfo[]>([])

export {
  albumResults,
  hasSearched,
  artistResults,
  keyword,
  musicResults,
  pagination,
  playlistResults,
  searching,
  searchError,
  searchType,
  selectedSource,
  selectedType,
  setKeyword,
  setSelectedSource,
  setSelectedType,
}

/** 当前类型对应的结果列表，用于空状态判断 */
export const currentResults = createMemo<AlbumInfo[] | ArtistInfo[] | MusicInfo[] | PlaylistInfo[]>(() => {
  switch (searchType()) {
    case 'music':
      return musicResults()
    case 'artist':
      return artistResults()
    case 'album':
      return albumResults()
    case 'playlist':
      return playlistResults()
  }
})

// 根据当前 provider 的能力动态禁用不支持的类型
export const availableTypeOptions = createMemo<Option<SearchType>[]>(() => {
  const provider = providers[selectedSource()] as Provider
  return typeOptions.map((opt) => {
    let isDisabled = false
    if (opt.value === 'music' && !provider.search)
      isDisabled = true
    else if (opt.value === 'album' && !provider.searchAlbum)
      isDisabled = true
    else if (opt.value === 'artist' && !provider.searchArtist)
      isDisabled = true
    else if (opt.value === 'playlist' && !provider.searchPlaylist)
      isDisabled = true
    return { ...opt, disabled: isDisabled }
  })
})

export async function handleSearch(page: number, type: SearchType) {
  if (searching())
    return
  setSearchError(null)
  const kw = keyword().trim()
  if (!kw) {
    setHasSearched(false)
    clearResults()
    return
  }
  const revision = ++searchRevision
  setPagination({ ...pagination(), page })
  const provider = providers[selectedSource()] as Provider
  setSearching(true)
  setHasSearched(true)

  let searchFn: Provider['search'] | Provider['searchArtist'] | Provider['searchAlbum'] | Provider['searchPlaylist']
  if (type === 'music')
    searchFn = provider.search
  else if (type === 'artist')
    searchFn = provider.searchArtist
  else if (type === 'album')
    searchFn = provider.searchAlbum
  else if (type === 'playlist')
    searchFn = provider.searchPlaylist

  if (!searchFn) {
    console.warn(`Provider ${selectedSource()} does not support searching for type ${type}`)
    clearResults()
    setSearchError('当前音源不支持此搜索类型，请切换音源或类型')
    setSearching(false)
    return
  }

  try {
    const [items, pageData] = await searchFn(kw, page)
    if (revision !== searchRevision)
      return
    setSearchType(type)
    if (type === 'music')
      setMusicResults(items as MusicInfo[])
    else if (type === 'artist')
      setArtistResults(items as ArtistInfo[])
    else if (type === 'album')
      setAlbumResults(items as AlbumInfo[])
    else
      setPlaylistResults(items as PlaylistInfo[])
    setPagination(pageData)
  }
  catch (error) {
    if (revision !== searchRevision)
      return
    console.error('Search error:', error)
    // 失败了就不是「没搜到」，把原因留在页面上而不是冒充空结果
    clearResults()
    setSearchError(errorMessage(error))
  }
  finally {
    if (revision === searchRevision)
      setSearching(false)
  }
}

/** 切换音源时清空旧结果，并忽略仍在途的旧音源响应。 */
function setSelectedSource(source: SourceValue) {
  if (source === selectedSource())
    return
  ++searchRevision
  setSelectedSourceState(source)
  const provider = providers[source]
  const capabilities = { music: provider.search, artist: provider.searchArtist, album: provider.searchAlbum, playlist: provider.searchPlaylist }
  if (!capabilities[selectedType()])
    setSelectedType('music')
  clearResults()
  setHasSearched(false)
  setSearchError(null)
  setSearching(false)
}

function clearResults() {
  setMusicResults([])
  setArtistResults([])
  setAlbumResults([])
  setPlaylistResults([])
  setPagination(emptyPagination())
}
