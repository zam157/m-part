import type { MusicInfo, SourceInfo } from './music-info'

export type ProviderName = 'bili'
export type SearchType = 'music' | 'album' | 'artist'

export interface Pagination {
  page: number
  pageSize: number
  total: number
}

export interface Provider {
  name: ProviderName
  /** Retrieves the source information for a given music item */
  getSourceInfo?: (musicInfo: MusicInfo) => Promise<SourceInfo>
  /** Retrieves the playlist for a given music item */
  getPlaylist?: () => Promise<[MusicInfo[], Pagination?]>
  /** Searches for music items based on keyword */
  search?: (keyword: string, page: number, type: SearchType) => Promise<[MusicInfo[], Pagination?]>
}
