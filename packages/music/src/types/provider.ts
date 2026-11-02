import type { AlbumInfo, ArtistInfo, MusicInfo, PlaylistInfo, SourceInfo } from './music-info'

export type ProviderName = 'bili' | 'netease' | 'qq'
export type SearchType = 'music' | 'album' | 'artist' | 'playlist'

export interface ProviderCookieTarget {
  /** Fixed HTTPS API origin, without a trailing slash. */
  origin: `https://${string}`
  /** API pathname prefix; use exact for a single endpoint. */
  path: `/${string}`
  exact?: boolean
}

export interface ProviderCookieConfig {
  label: string
  placeholder: string
  loginUrl: string
  /** Origin / Referer used by the Web forwarder. */
  requestOrigin: `https://${string}`
  /** Stable, globally unique extension session rule ID. Do not change existing IDs. */
  ruleId: number
  targets: readonly [ProviderCookieTarget, ...ProviderCookieTarget[]]
  /** Login fields allowed to leave the client when the host uses server sourcing. */
  session?: {
    names: readonly string[]
    required: readonly (readonly string[])[]
    /** Fields indicating a login attempt; visitor identity fields alone need not imply a partial login. */
    loginIndicators?: readonly string[]
    /** Candidate request URLs, in priority order. Choose one complete session, never mix accounts across URLs. */
    urls?: readonly `https://${string}`[]
    /** Cookie ownership domains, without a leading dot; include parent domains shared by query hosts. */
    domains: readonly [string, ...string[]]
  }
}

/** Lightweight metadata shared with transport; must not import a Provider implementation. */
export interface ProviderDefinition {
  name: ProviderName
  /** Omit when this provider does not support manually supplied Cookie sessions. */
  cookie?: ProviderCookieConfig
}

export type ImageUsage = 'queue' | 'player' | 'list' | 'card' | 'collection' | 'detail' | 'expanded' | 'background' | 'media-session'
export interface ImageOptions {
  usage: ImageUsage
  /** Requested physical pixels, including the requested pixel density. */
  width: number
  height: number
  fit: 'cover' | 'contain'
}

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

export interface PlaylistTracksOptions {
  signal?: AbortSignal
  /** 已获取的曲目资料，可用于复用首屏结果或续读失败批次。 */
  knownItems?: MusicInfo[]
  /** items 是按歌单顺序排列的累计结果；total 是歌单曲目 ID 总数。 */
  onProgress?: (progress: { items: MusicInfo[], total: number }) => void
}

export interface LyricsInfo {
  /** 原文、翻译、音译均为 LRC 或纯文本；纯音乐可没有原文。 */
  original: string
  translated?: string
  romanized?: string
  /** 可选的逐字原文（YRC / 增强 LRC）及对应时间轴的译文；缺失时使用普通 LRC。 */
  wordByWord?: { original: string, translated?: string, romanized?: string }
  instrumental?: boolean
}

export interface Provider extends ProviderDefinition {
  /** Pure CDN URL transformation. Keep unsupported URLs unchanged; never mutate stored cover URLs. */
  getImageUrl?: (url: string, options: ImageOptions) => string
  /** Resolve a container or an existing part into same-provider playable tracks, in source order with unique stable IDs. Return one track for a single-part item. */
  getTrackParts?: (music: MusicInfo, options?: { signal?: AbortSignal }) => Promise<MusicInfo[]>
  /** Identify resolved parts locally so normal playback can skip another lookup. Omit to resolve every explicit add. */
  isTrackPart?: (music: MusicInfo) => boolean
  /** User-facing part name; defaults to 分段. Only used when getTrackParts is implemented. */
  trackPartsLabel?: string
  /** 读取官方歌词；不支持歌词的音源可不实现。 */
  getLyrics?: (id: string, options?: { signal?: AbortSignal }) => Promise<LyricsInfo>
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
  /** 高效读取整单曲目；未实现时由客户端按 getPlaylist 分页回退。 */
  getAllPlaylistTracks?: (id: string, options?: PlaylistTracksOptions) => Promise<MusicInfo[]>
  /** Searches for music items based on keyword */
  search?: (keyword: string, page: number) => Promise<[MusicInfo[], Pagination]>
  /** Searches for artists based on keyword */
  searchArtist?: (keyword: string, page: number) => Promise<[ArtistInfo[], Pagination]>
  /** Searches for albums based on keyword */
  searchAlbum?: (keyword: string, page: number) => Promise<[AlbumInfo[], Pagination]>
  /** 搜索公开歌单，不要求先获取当前登录账号。 */
  searchPlaylist?: (keyword: string, page: number) => Promise<[PlaylistInfo[], Pagination]>
  /** Retrieves the details of a given artist */
  getArtistInfo?: (id: string | number) => Promise<ArtistInfo>
  /** Retrieves the works of a given artist */
  getArtistWorks?: (id: string | number, page: number) => Promise<[MusicInfo[], Pagination]>
  /** Retrieves the albums of a given artist */
  getArtistAlbums?: (id: string | number, page: number) => Promise<[AlbumInfo[], Pagination]>
  /** Retrieves the works of a given album */
  getAlbumWorks?: (id: string | number, page: number, extra: any) => Promise<[MusicInfo[], Pagination]>
}
