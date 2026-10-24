import type { MusicInfo } from '@m-part/music/types/music-info'
import { providers } from '@m-part/music/providers'
import { createSignal } from 'solid-js'
import { errorMessage } from '~/utils/index'
import { supportsTrackParts } from '~/utils/track-parts'

export type PartAction = 'play' | 'append' | 'next'
interface Selection { tracks: MusicInfo[], action: PartAction }
export const [trackParts, setTrackParts] = createSignal<{
  requestId: number, music: MusicInfo, action: PartAction, loading: boolean, tracks: MusicInfo[], error: string,
} | null>(null)
let pending: { id: number, music: MusicInfo, action: PartAction, force: boolean, controller: AbortController, resolve: (value: Selection | null) => void } | undefined
let version = 0

export function cancelTrackParts() {
  const previous = pending
  pending = undefined
  previous?.controller.abort()
  previous?.resolve(null)
  setTrackParts(null)
}
export async function retryTrackParts() {
  const request = pending
  if (!request) return
  setTrackParts({ requestId: request.id, music: request.music, action: request.action, loading: true, tracks: [], error: '' })
  try {
    const provider = providers[request.music.provider]
    if (!provider?.getTrackParts) throw new Error('当前音源不支持分段选择')
    const tracks = await provider.getTrackParts(request.music, { signal: request.controller.signal })
    if (pending !== request) return
    if (!tracks.length) throw new Error('没有可播放的分段')
    if (tracks.length === 1 && !request.force) {
      pending = undefined; setTrackParts(null); request.resolve({ tracks, action: request.action }); return
    }
    setTrackParts({ requestId: request.id, music: request.music, action: request.action, loading: false, tracks, error: '' })
  }
  catch (error) {
    if (pending === request) setTrackParts({ requestId: request.id, music: request.music, action: request.action, loading: false, tracks: [], error: errorMessage(error) })
  }
}
export function chooseTrackParts(music: MusicInfo, action: PartAction = 'play', force = false): Promise<Selection | null> {
  cancelTrackParts()
  if (!supportsTrackParts(music)) return Promise.resolve(null)
  return new Promise((resolve) => {
    pending = { id: ++version, music, action, force, controller: new AbortController(), resolve }
    void retryTrackParts()
  })
}
export function confirmTrackParts(tracks: MusicInfo[], action: PartAction) {
  const request = pending
  if (!request || !tracks.length) return
  pending = undefined
  setTrackParts(null)
  request.resolve({ tracks, action })
}
