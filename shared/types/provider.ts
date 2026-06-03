import type { AlbumInfo, ArtistInfo, MusicInfo, SourceInfo } from './music-info'

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
  getPlaylist?: () => Promise<[MusicInfo[], Pagination]>
  /** Searches for music items based on keyword */
  search?: (keyword: string, page: number) => Promise<[MusicInfo[], Pagination]>
  /** Searches for artists based on keyword */
  searchArtist?: (keyword: string, page: number) => Promise<[ArtistInfo[], Pagination]>
  /** Searches for albums based on keyword */
  searchAlbum?: (keyword: string, page: number) => Promise<[AlbumInfo[], Pagination]>
  /** Retrieves the details of a given artist */
  getArtistInfo?: (id: string | number) => Promise<ArtistInfo>
  /** Retrieves the works of a given artist */
  getArtistWorks?: (id: string | number, page: number) => Promise<[MusicInfo[], Pagination]>
  /** Retrieves the albums of a given artist */
  getArtistAlbums?: (id: string | number, page: number) => Promise<[AlbumInfo[], Pagination]>
  /** Retrieves the works of a given album */
  getAlbumWorks?: (id: string | number, page: number, extra: any) => Promise<[MusicInfo[], Pagination]>
}
