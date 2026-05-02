import type { MusicInfo, SourceInfo } from './music-info'

type SearchType = 'music' | 'album' | 'artist'

export interface Provider {
  name: string
  /** Retrieves the source information for a given music item */
  getSourceInfo?: (musicInfo: MusicInfo) => Promise<SourceInfo>
  /** Retrieves the playlist for a given music item */
  getPlaylist?: () => Promise<MusicInfo[]>
  /** Searches for music items based on keyword */
  search?: (keyword: string, page: number, type: SearchType) => Promise<MusicInfo[]>
}
