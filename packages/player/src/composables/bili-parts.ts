import type { MusicInfo } from '@m-part/music/types/music-info'
import { providers } from '@m-part/music/providers'
import { createSignal } from 'solid-js'
import { errorMessage } from '~/utils/index'

export type PartAction = 'play' | 'append' | 'next'
interface Selection { tracks: MusicInfo[], action: PartAction }
export const [biliParts, setBiliParts] = createSignal<{
  requestId: number, music: MusicInfo, action: PartAction, loading: boolean, tracks: MusicInfo[], error: string,
} | null>(null)
let pending: { id: number, music: MusicInfo, action: PartAction, force: boolean, controller: AbortController, resolve: (value: Selection | null) => void } | undefined
let version = 0

export function cancelBiliParts() {
  const previous = pending
  pending = undefined
  previous?.controller.abort()
  previous?.resolve(null)
  setBiliParts(null)
}
export async function retryBiliParts() {
  const request = pending
  if (!request) return
  setBiliParts({ requestId: request.id, music: request.music, action: request.action, loading: true, tracks: [], error: '' })
  try {
    const tracks = await providers.bili.getTrackParts!(request.music, { signal: request.controller.signal })
    if (pending !== request) return
    if (tracks.length === 1 && !request.force) {
      pending = undefined; setBiliParts(null); request.resolve({ tracks, action: request.action }); return
    }
    setBiliParts({ requestId: request.id, music: request.music, action: request.action, loading: false, tracks, error: '' })
  }
  catch (error) {
    if (pending === request) setBiliParts({ requestId: request.id, music: request.music, action: request.action, loading: false, tracks: [], error: errorMessage(error) })
  }
}
export function chooseBiliParts(music: MusicInfo, action: PartAction = 'play', force = false): Promise<Selection | null> {
  cancelBiliParts()
  return new Promise((resolve) => {
    pending = { id: ++version, music, action, force, controller: new AbortController(), resolve }
    void retryBiliParts()
  })
}
export function confirmBiliParts(tracks: MusicInfo[], action: PartAction) {
  const request = pending
  if (!request || !tracks.length) return
  pending = undefined
  setBiliParts(null)
  request.resolve({ tracks, action })
}
