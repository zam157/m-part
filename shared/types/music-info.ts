export interface MusicInfo {
  /** The provider of the music. i.e., netease, qq */
  provider: string
  /** The unique identifier for the music */
  id: string
  title: string
  srcUrl?: string
  artist: string
  duration: number
  coverUrl: string
  album: string
  qualities: MusicQuality[]
  lrcUrl?: string
  lrc?: string
}

export interface SourceInfo {
  url: string
  [key: string]: any
}

export interface MusicQuality {
  name: string
  size: number
  url: string
  bitrate?: number
}
