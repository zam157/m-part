import type { AlbumInfo, ArtistInfo, MusicInfo, PlaylistInfo, SourceInfo } from './music-info'

export type ProviderName = 'bili' | 'netease'
export type SearchType = 'music' | 'album' | 'artist'

export interface Pagination {
  page: number
  pageSize: number
  total: number
}

export interface ProviderUser {
  id: string
  name: string
  coverUrl?: string
}

export interface CollectionPage<T> {
  items: T[]
  hasMore: boolean
}

export interface Provider {
  name: ProviderName
  /** 首页推荐音乐；无需登录可用，返回值可直接加入播放队列。 */
  getRecommendations?: () => Promise<MusicInfo[]>
  /** Retrieves the source information for a given music item */
  getSourceInfo?: (musicInfo: MusicInfo) => Promise<SourceInfo>
  /** 读取浏览器登录态，未登录返回 null；网络失败仍抛错。 */
  getCurrentUser?: () => Promise<ProviderUser | null>
  /** 当前用户创建及收藏的歌单 / 收藏夹，page 从 1 开始。 */
  getPlaylists?: (userId: string, page: number) => Promise<CollectionPage<PlaylistInfo>>
  /** 歌单曲目分页，与本地 playQueue 播放队列无关。 */
  getPlaylist?: (id: string, page: number) => Promise<CollectionPage<MusicInfo>>
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
