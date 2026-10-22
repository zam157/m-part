import { flush } from 'solid-js'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { dispatchRoomPlayer, setRoomPlayerHandler } from '~/composables/player-context'
import type { RoomPlayerAction } from '~/composables/player-context'

const { source } = vi.hoisted(() => ({ source: vi.fn() }))
vi.mock('#shared/utils/providers', () => ({ providers: { netease: { getSourceInfo: source } } }))
vi.mock('#shared/utils/constants', () => ({ TARGET_EXTENSION: true }))
const player = await import('~/composables/player')
const controls = await import('~/components/MusicPlayer/components/player-controls')
const song = { provider: 'netease' as const, id: 'one', title: 'One', duration: 120, coverUrl: '' }
let actions: RoomPlayerAction[]
beforeEach(() => {
  setRoomPlayerHandler(undefined)
  source.mockReset().mockResolvedValue({ url: 'https://cdn.example/full', availability: 'full' })
  vi.spyOn(player.audio, 'pause').mockImplementation(() => {})
  vi.spyOn(player.audio, 'load').mockImplementation(() => {})
  vi.spyOn(player.audio, 'play').mockResolvedValue()
  vi.spyOn(console, 'error').mockImplementation(() => {})
  player.restorePlayerSession({ queue: { items: [song], playMode: 'order', randomOrder: null } })
  flush()
  actions = []
  setRoomPlayerHandler(action => actions.push(action))
})
afterEach(() => { setRoomPlayerHandler(undefined); flush(); vi.restoreAllMocks() })

describe('all product controls delegate to room intent', () => {
  it('routes playback, seek, queue and mode without executing local media or random choices', async () => {
    await player.setPlaying(true); player.setCurrentTime(20); await player.prevNext(1)
    await player.setCurrentIndex(0); player.setPlayMode('random'); await player.setPlayQueue([])
    await player.addToPlayQueue(song); await player.addNextToPlayQueue(song); await player.removeFromPlayQueue(0)
    expect(actions.map(a => a.type)).toEqual(['play', 'seek', 'next', 'select', 'mode', 'queue', 'append', 'add-next', 'remove'])
    expect(player.audio.play).not.toHaveBeenCalled()
    expect(source).not.toHaveBeenCalled()
    expect(player.playQueue()).toHaveLength(1)
    expect(player.playMode()).toBe('order')
  })
  it('only reports ended, without locally advancing or looping', () => {
    player.audio.dispatchEvent(new Event('ended'))
    expect(actions).toEqual([{ type: 'ended' }])
    expect(player.audio.play).not.toHaveBeenCalled()
  })
  it('quality and retry bypass their old local pause/seek/restart sequences', async () => {
    await controls.selectQuality({ name: '320K', url: 'https://cdn.example/quality' })
    await controls.retryPlayback()
    expect(actions.map(a => a.type)).toEqual(['quality', 'retry'])
    expect(player.audio.play).not.toHaveBeenCalled()
  })
  it('rejects previews before any attempt to play them', async () => {
    source.mockResolvedValueOnce({ url: 'https://cdn.example/preview', availability: 'preview' })
    await expect(player.loadRoomSource(song, 0, new AbortController().signal)).rejects.toThrow('试听')
    expect(player.audio.play).not.toHaveBeenCalled()
  })
  it('a cancelled late provider result cannot overwrite the next room track', async () => {
    let finish!: (value: unknown) => void
    source.mockReturnValueOnce(new Promise(resolve => { finish = resolve }))
    const firstController = new AbortController()
    const first = player.loadRoomSource(song, 0, firstController.signal)
    firstController.abort()
    await player.loadRoomSource({ ...song, id: 'two' }, 1, new AbortController().signal)
    finish({ url: 'https://cdn.example/stale', availability: 'full' })
    expect(await first).toBe('stale')
    expect(player.audio.src).toBe('https://cdn.example/full')
  })
  it('late cleanup from an old room cannot remove a newer control owner', () => {
    const old = vi.fn()
    const newer = vi.fn()
    const disposeOld = setRoomPlayerHandler(old)
    setRoomPlayerHandler(newer)
    expect(disposeOld()).toBe(false)
    dispatchRoomPlayer({ type: 'play', playing: true })
    expect(old).not.toHaveBeenCalled()
    expect(newer).toHaveBeenCalledOnce()
  })
})
