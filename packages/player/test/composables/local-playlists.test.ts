import { flush } from 'solid-js'
import { describe, expect, it, vi } from 'vitest'
import { createLocalPlaylistLibrary } from '~/composables/local-playlists'
import { decodeLocalPlaylist, localPlaylistTracks } from '~/utils/local-playlist-storage'
import type { LocalPlaylist, LocalPlaylistStorage } from '~/utils/local-playlist-storage'

const song = { provider: 'netease' as const, id: '1', title: '歌曲', duration: 120, coverUrl: '', src: 'https://cdn.example/signed?token=private', lrcUrl: 'https://cdn.example/temporary', cookie: 'must-not-save' }
function memoryStorage() {
  const rows = new Map<string, LocalPlaylist>()
  const storage: LocalPlaylistStorage = {
    read: vi.fn(async () => structuredClone([...rows.values()])),
    update: vi.fn(async (id, change) => {
      const value = change(structuredClone(rows.get(id)))
      if (value) rows.set(id, structuredClone(value))
      else rows.delete(id)
      return structuredClone([...rows.values()])
    }),
    close: vi.fn(),
  }
  return storage
}

describe('local playlist persistence', () => {
  it('creates, renames and restores mixed-provider playlists without saving audio URLs or credentials', async () => {
    const storage = memoryStorage()
    const first = createLocalPlaylistLibrary(storage)
    const playlist = await first.create('  常听  ', [song, { ...song, provider: 'bili', id: 'BV1:123' }]); flush()
    expect(playlist.title).toBe('常听')
    expect(playlist.tracks).toHaveLength(2)
    for (const key of ['src', 'lrcUrl', 'cookie']) expect(playlist.tracks[0]).not.toHaveProperty(key)
    await first.change(playlist.id, current => ({ ...current, title: '通勤' })); flush()
    const second = createLocalPlaylistLibrary(storage)
    await second.load(); flush()
    expect(second.state().items[0]).toMatchObject({ id: playlist.id, title: '通勤', tracks: [{ provider: 'netease', id: '1' }, { provider: 'bili', id: 'BV1:123' }] })
  })
  it('deduplicates by provider and ID while preserving order and saving concurrent additions', async () => {
    const library = createLocalPlaylistLibrary(memoryStorage())
    const playlist = await library.create('收藏', [song])
    await Promise.all([
      library.change(playlist.id, current => ({ ...current, tracks: [...current.tracks, song, { ...song, id: '2' }] })),
      library.change(playlist.id, current => ({ ...current, tracks: [...current.tracks, { ...song, provider: 'qq' }] })),
    ]); flush()
    expect(library.state().items[0]!.tracks.map(track => `${track.provider}:${track.id}`)).toEqual(['netease:1', 'netease:2', 'qq:1'])
  })
  it('does not publish a failed save, exposes the error, and permits a retry', async () => {
    const storage = memoryStorage()
    const library = createLocalPlaylistLibrary(storage)
    const playlist = await library.create('收藏', [song]); flush()
    vi.mocked(storage.update).mockRejectedValueOnce(new Error('空间不足'))
    await expect(library.change(playlist.id, current => ({ ...current, tracks: [] }))).rejects.toThrow('空间不足'); flush()
    expect(library.state().items[0]!.tracks).toHaveLength(1)
    expect(library.state().error).toBe('空间不足')
    await library.change(playlist.id, current => ({ ...current, tracks: [] })); flush()
    expect(library.state().items[0]!.tracks).toHaveLength(0)
    expect(library.state().error).toBe('')
  })
  it('removes tracks and deletes playlists durably, rejecting edits of a deleted playlist', async () => {
    const storage = memoryStorage()
    const library = createLocalPlaylistLibrary(storage)
    const playlist = await library.create('收藏', [song, { ...song, id: '2' }])
    await library.change(playlist.id, current => ({ ...current, tracks: current.tracks.filter(track => track.id !== '1') }))
    await library.load(true); flush()
    expect(library.state().items[0]!.tracks.map(track => track.id)).toEqual(['2'])
    await library.change(playlist.id, () => undefined); flush()
    expect(library.state().items).toEqual([])
    await expect(library.change(playlist.id, current => current)).rejects.toThrow('已被删除')
    expect(await storage.read()).toEqual([])
  })
  it('rejects invalid names without writing and preserves usable records from malformed stored data', async () => {
    const storage = memoryStorage()
    const library = createLocalPlaylistLibrary(storage)
    await expect(library.create('   ')).rejects.toThrow('请输入')
    await expect(library.create('字'.repeat(81))).rejects.toThrow('80')
    expect(storage.update).not.toHaveBeenCalled()
    expect(decodeLocalPlaylist(null)).toBeUndefined()
    expect(decodeLocalPlaylist({ id: 'x', title: '有效', tracks: [null, song, song, { ...song, provider: 'unknown' }] })?.tracks).toEqual(localPlaylistTracks([song]))
  })
})
