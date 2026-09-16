import type { AlbumInfo, ArtistInfo, MusicInfo } from '#shared/types/music-info'
import type { Pagination, Provider, ProviderName, SearchType } from '#shared/types/provider'
import type { Option } from '~/components/Select/type'
import { providers } from '#shared/utils/providers/index'
import { createMemo, createSignal } from 'solid-js'

/**
 * 搜索页状态提升到模块级单例。
 *
 * Solid Router 没有 KeepAlive，页面组件在离开路由后会被卸载；把状态放在模块作用域
 * 可以让关键词、结果与分页在页面之间往返时保留下来（等价于原来的 keep-alive 行为）。
 */

export const sourceOptions = [
  { label: 'BiliBili', value: 'bili' },
  // { label: '网易云', value: 'netease' },
  // { label: 'QQ音乐', value: 'qq' },
] as const satisfies Option<ProviderName>[]

export const typeOptions = [
  { label: '歌曲', value: 'music' },
  { label: '专辑', value: 'album' },
  { label: '歌手', value: 'artist' },
] as const satisfies Option<SearchType>[]

type SourceValue = typeof sourceOptions[number]['value']
type TypeValue = typeof typeOptions[number]['value']

/** 空分页（重置时复用） */
function emptyPagination(): Pagination {
  return { page: 1, total: 0, pageSize: 20 }
}

const [selectedSource, setSelectedSource] = createSignal<SourceValue>(sourceOptions[0].value)
const [selectedType, setSelectedType] = createSignal<TypeValue>(typeOptions[0].value)
const [keyword, setKeyword] = createSignal('')
const [searching, setSearching] = createSignal(false)
/** 当前结果所属的搜索类型（可能与所选类型不同，取决于最后一次成功的搜索） */
const [searchType, setSearchType] = createSignal<SearchType>(typeOptions[0].value)
const [pagination, setPagination] = createSignal<Pagination>(emptyPagination())
const [musicResults, setMusicResults] = createSignal<MusicInfo[]>([])
const [artistResults, setArtistResults] = createSignal<ArtistInfo[]>([])
const [albumResults, setAlbumResults] = createSignal<AlbumInfo[]>([])

export {
  albumResults,
  artistResults,
  keyword,
  musicResults,
  pagination,
  searching,
  searchType,
  selectedSource,
  selectedType,
  setKeyword,
  setSelectedSource,
  setSelectedType,
}

/** 当前类型对应的结果列表，用于空状态判断 */
export const currentResults = createMemo<AlbumInfo[] | ArtistInfo[] | MusicInfo[]>(() => {
  switch (searchType()) {
    case 'music':
      return musicResults()
    case 'artist':
      return artistResults()
    case 'album':
      return albumResults()
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
    return { ...opt, disabled: isDisabled }
  })
})

export async function handleSearch(page: number, type: SearchType) {
  if (searching())
    return
  const kw = keyword().trim()
  if (!kw) {
    clearResults()
    return
  }
  setPagination({ ...pagination(), page })
  const provider = providers[selectedSource()] as Provider
  setSearching(true)

  let searchFn: Provider['search'] | Provider['searchArtist'] | Provider['searchAlbum']
  if (type === 'music')
    searchFn = provider.search
  else if (type === 'artist')
    searchFn = provider.searchArtist
  else if (type === 'album')
    searchFn = provider.searchAlbum

  if (!searchFn) {
    console.warn(`Provider ${selectedSource()} does not support searching for type ${type}`)
    clearResults()
    setSearching(false)
    return
  }

  try {
    const [items, pageData] = await searchFn(kw, page)
    setSearchType(type)
    if (type === 'music')
      setMusicResults(items as MusicInfo[])
    else if (type === 'artist')
      setArtistResults(items as ArtistInfo[])
    else
      setAlbumResults(items as AlbumInfo[])
    setPagination(pageData)
  }
  catch (error) {
    console.error('Search error:', error)
    clearResults()
  }
  finally {
    setSearching(false)
  }
}

function clearResults() {
  setMusicResults([])
  setArtistResults([])
  setAlbumResults([])
  setPagination(emptyPagination())
}
