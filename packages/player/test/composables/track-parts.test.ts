import type { MusicInfo } from '@m-part/music/types/music-info'
import { flush } from 'solid-js'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
const { resolveParts } = vi.hoisted(() => ({ resolveParts: vi.fn() }))
vi.mock('@m-part/music/providers', () => ({ providers: {
  qq: { name: 'qq', getTrackParts: resolveParts, isTrackPart: (music: MusicInfo) => music.id.startsWith('segment/') },
  netease: { name: 'netease' },
} }))
import * as player from '~/composables/player'
import { cancelTrackParts, confirmTrackParts, trackParts } from '~/composables/track-parts'
import { setRoomControlsWritable, setRoomPlayerHandler } from '~/composables/player-context'
import { publicTrack } from '~/utils/listen-client'

const container: MusicInfo = { provider: 'qq', id: 'collection:root', title: '合集', duration: 300, coverUrl: '' }
const parts = ['one', 'two'].map((id, i): MusicInfo => ({ ...container, id: `segment/${id}`, title: `章节 ${i + 1}`, duration: 120, src: `https://cdn.example/${id}.mp3` }))
const standalone: MusicInfo = { ...parts[0]!, provider: 'netease', id: 'ordinary' }
const tick = async () => { await Promise.resolve(); await Promise.resolve(); flush() }
beforeEach(async () => {
  setRoomPlayerHandler(); flush()
  vi.spyOn(player.audio, 'pause').mockImplementation(() => {})
  vi.spyOn(player.audio, 'load').mockImplementation(() => {})
  vi.spyOn(player.audio, 'play').mockResolvedValue()
  await player.setPlayQueue([]); flush()
  resolveParts.mockReset().mockResolvedValue(parts)
})
afterEach(() => { cancelTrackParts(); setRoomPlayerHandler(); flush(); vi.restoreAllMocks() })

it('automatically resolves a non-Bili container and plays the selected tracks once', async () => {
  const pending = player.addToPlayQueue(container)
  await tick()
  expect(trackParts()?.music).toBe(container)
  expect(player.playQueue()).toEqual([])
  vi.mocked(player.audio.play).mockClear()
  confirmTrackParts(parts, 'play'); await pending; flush()
  expect(resolveParts).toHaveBeenCalledOnce()
  expect(player.playQueue()).toEqual(parts)
  expect(player.currentSong()?.id).toBe('segment/one')
  expect(player.audio.play).toHaveBeenCalledOnce()
})

it('skips lookups for resolved parts but supports explicitly reopening their selector', async () => {
  await player.addToPlayQueue(parts[1]!); flush()
  expect(resolveParts).not.toHaveBeenCalled()
  expect(player.currentSong()?.id).toBe('segment/two')
  const pending = player.openTrackParts(parts[1]!)
  await tick()
  expect(trackParts()?.music.id).toBe('segment/two')
  cancelTrackParts(); await pending
  expect(resolveParts).toHaveBeenCalledOnce()
})

it('leaves providers without part support on the ordinary playback path', async () => {
  await player.addToPlayQueue(standalone); flush()
  expect(player.currentSong()?.id).toBe('ordinary')
  expect(resolveParts).not.toHaveBeenCalled()
  expect(trackParts()).toBeNull()
})

it('inserts selected non-Bili parts next without interrupting existing audio', async () => {
  await player.setPlayQueue([standalone]); flush()
  const pending = player.addNextToPlayQueue(container)
  await tick()
  vi.mocked(player.audio.play).mockClear(); vi.mocked(player.audio.pause).mockClear(); vi.mocked(player.audio.load).mockClear()
  confirmTrackParts(parts, 'next'); await pending; flush()
  expect(player.playQueue().map(track => track.id)).toEqual(['ordinary', 'segment/one', 'segment/two'])
  expect(player.currentSong()?.id).toBe('ordinary')
  expect(player.audio.play).not.toHaveBeenCalled(); expect(player.audio.pause).not.toHaveBeenCalled(); expect(player.audio.load).not.toHaveBeenCalled()
})

it('dispatches selected non-Bili parts as one room command', async () => {
  const handler = vi.fn()
  setRoomPlayerHandler(handler); setRoomControlsWritable(true); flush()
  const pending = player.addToPlayQueue(container)
  await tick()
  confirmTrackParts(parts, 'play'); await pending; flush()
  expect(handler).toHaveBeenCalledExactlyOnceWith({ type: 'append-many', tracks: parts, placement: 'end', autoplay: true })
  expect(player.playQueue()).toEqual([])
})

it('discards a selection after the playback context changes', async () => {
  const pending = player.addToPlayQueue(container)
  await tick()
  const handler = vi.fn()
  setRoomPlayerHandler(handler); setRoomControlsWritable(true); flush()
  confirmTrackParts(parts, 'play'); await pending; flush()
  expect(handler).not.toHaveBeenCalled()
  expect(player.playQueue()).toEqual([])
})

it('does not start a lookup for a read-only room member', async () => {
  setRoomPlayerHandler(vi.fn()); flush()
  await player.addToPlayQueue(container); flush()
  expect(resolveParts).not.toHaveBeenCalled()
  expect(trackParts()).toBeNull()
})

it('treats unresolved container duration as unknown for rooms and preserves authoritative snapshots', () => {
  expect(publicTrack(container).duration).toBe(0)
  expect(publicTrack(parts[0]!).duration).toBe(120)
  expect(publicTrack(container, { preserveDuration: true }).duration).toBe(300)
  expect(publicTrack(standalone).duration).toBe(120)
})
