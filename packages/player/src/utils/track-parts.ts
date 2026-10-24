import type { MusicInfo } from '@m-part/music/types/music-info'
import { providers } from '@m-part/music/providers'

export function supportsTrackParts(music?: MusicInfo | null) {
  return !!music && !!providers[music.provider]?.getTrackParts
}

export function needsTrackParts(music: MusicInfo) {
  const provider = providers[music.provider]
  return !!provider?.getTrackParts && !provider.isTrackPart?.(music)
}

export function getTrackPartsLabel(music?: MusicInfo | null) {
  return music && providers[music.provider]?.trackPartsLabel || '分段'
}
