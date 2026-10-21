import type { AlbumInfo, ArtistInfo, MusicInfo, SourceInfo } from './music-info'

export type ProviderName = 'bili' | 'netease'
export type SearchType = 'music' | 'album' | 'artist'

export interface Pagination {
  page: number
  pageSize: number
  total: number
}

export interface Provider {
  name: ProviderName
  /** 首页推荐音乐；无需登录可用，返回值可直接加入播放队列。 */
  getRecommendations?: () => Promise<MusicInfo[]>
  /** Retrieves the source information for a given music item */
  getSourceInfo?: (musicInfo: MusicInfo) => Promise<SourceInfo>
  /**
   * 获取歌单（用户收藏的歌曲集合）。
   *
   * 注意：与“播放列表 / 播放队列”（`client/composables/player.ts` 的 `playQueue`）无关。
   */
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
