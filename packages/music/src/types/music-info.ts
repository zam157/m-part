import type { ProviderName } from './provider'

export interface MusicInfo {
  /** The provider of the music. i.e., netease, qq */
  provider: ProviderName
  /** The unique identifier for the music */
  id: string
  title: string
  description?: string
  src?: string
  artist?: string
  duration: number
  coverUrl: string
  album?: string
  lrcUrl?: string
  lrc?: string
}

export interface ArtistInfo {
  provider: ProviderName
  id: string | number
  name: string
  coverUrl?: string
  description?: string
}

export interface PlaylistInfo {
  provider: ProviderName
  id: string
  title: string
  coverUrl: string
  totalTracks: number
  creator?: string
  description?: string
  /** 仅在已识别当前账号时标记归属；公开搜索结果不推断归属。 */
  owned?: boolean
}

export interface AlbumInfo {
  provider: ProviderName
  id: string
  title: string
  artist: string
  coverUrl: string
  totalTracks?: number
  description?: string
  releaseDate?: string
  extra?: Record<string, unknown>
}

export interface SourceInfo {
  /** Canonical metadata after resolving a legacy container entry. Never includes media URLs. */
  track?: MusicInfo
  /** Explicit playback rights; room sync must never treat a preview as a full track. */
  availability?: 'full' | 'preview' | 'unknown'
  url?: string
  headers?: Record<string, any>
  qualities?: MusicQuality[]
  [key: string]: unknown
}

export interface MusicQuality {
  name: string
  url: string
  active?: boolean
}
