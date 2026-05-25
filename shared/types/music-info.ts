import type { ProviderName } from './provider'

export interface MusicInfo {
  /** The provider of the music. i.e., netease, qq */
  provider: ProviderName
  /** The unique identifier for the music */
  id: string
  title: string
  src?: string
  artist: string
  duration: number
  coverUrl: string
  album: string
  lrcUrl?: string
  lrc?: string
}

export interface SourceInfo {
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
