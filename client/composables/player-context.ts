import type { MusicInfo, MusicQuality } from '#shared/types/music-info'
import { createSignal } from 'solid-js'

export type RoomPlayerAction =
  | { type: 'play', playing: boolean }
  | { type: 'seek', position: number }
  | { type: 'select' | 'remove', index: number }
  | { type: 'next', direction: 0 | 1 }
  | { type: 'queue', tracks: MusicInfo[] }
  | { type: 'append' | 'add-next', track: MusicInfo }
  | { type: 'mode', mode: 'order' | 'loop' | 'random' | 'single-loop' }
  | { type: 'quality', quality: MusicQuality }
  | { type: 'retry' | 'ended' }

const [roomPlayerActive, setActive] = createSignal(false)
export const [roomControlsWritable, setRoomControlsWritable] = createSignal(true)
export const canControlRoom = () => !roomPlayerActive() || roomControlsWritable()
let handler: ((action: RoomPlayerAction) => void) | undefined
export { roomPlayerActive }
export function isRoomPlayer() { return !!handler }
export function setRoomPlayerHandler(next?: (action: RoomPlayerAction) => void) {
  handler = next
  setActive(!!next)
  setRoomControlsWritable(!next)
  return () => {
    if (handler !== next) return false
    handler = undefined
    setActive(false)
    setRoomControlsWritable(true)
    return true
  }
}
/** All user entry points delegate here; remote application uses separate raw methods. */
export function dispatchRoomPlayer(action: RoomPlayerAction): boolean {
  if (!handler) return false
  handler(action)
  return true
}
