import type { MusicInfo } from '@m-part/music/types/music-info'
import { flush } from 'solid-js'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@m-part/music/providers', () => ({ providers: {} }))
const player = await import('~/composables/player')
const songs: MusicInfo[] = ['a', 'b', 'c', 'd'].map(id => ({ provider: 'bili', id, title: id, duration: 100, coverUrl: '', src: `https://cdn.example/${id}.mp3` }))
const ids = () => player.playQueue().map(song => song.id)

beforeEach(async () => {
  vi.spyOn(player.audio, 'pause').mockImplementation(() => {})
  vi.spyOn(player.audio, 'load').mockImplementation(() => {})
  vi.spyOn(player.audio, 'play').mockResolvedValue()
  player.setPlayMode('order')
  await player.setPlayQueue([])
  flush()
})
afterEach(() => vi.restoreAllMocks())

describe('随机切歌', () => {
  it('恢复随机顺序后，前后切歌及首尾循环都不使用队列索引相邻项', async () => {
    player.restorePlayerSession({
      queue: { items: songs, playMode: 'random', randomOrder: [2, 0, 3, 1] },
      position: { song: { provider: 'bili', id: 'c' }, time: 0 },
    })
    flush()
    const visited: string[] = []
    for (let step = 0; step < 4; step++) {
      await player.prevNext(1, false)
      flush()
      visited.push(player.currentSong()!.id)
    }
    expect(visited).toEqual(['a', 'd', 'b', 'c'])
    await player.prevNext(0, false)
    flush()
    expect(player.currentSong()?.id).toBe('b')
    await player.prevNext(1, false)
    flush()
    expect(player.currentSong()?.id).toBe('c')
    expect(ids()).toEqual(['a', 'b', 'c', 'd'])
    expect(player.randomPlayQueue()).toEqual([2, 0, 3, 1])
  })
})

describe('添加到下一首', () => {
  it('batches selected parts without interrupting the current audio and keeps each CID separate', async () => {
    await player.setPlayQueue(songs.slice(0, 2)); flush()
    const parts = [123, 456].map(cid => ({ ...songs[0]!, id: `BV1234567890:${cid}`, title: `Part ${cid}` }))
    vi.mocked(player.audio.pause).mockClear(); vi.mocked(player.audio.play).mockClear(); vi.mocked(player.audio.load).mockClear()
    await player.addTracksToPlayQueue([...parts, parts[0]!], 'next'); flush()
    expect(ids()).toEqual(['a', 'BV1234567890:123', 'BV1234567890:456', 'b'])
    expect(player.currentIndex()).toBe(0)
    expect(player.audio.pause).not.toHaveBeenCalled(); expect(player.audio.play).not.toHaveBeenCalled(); expect(player.audio.load).not.toHaveBeenCalled()
  })
  it.each(['order', 'loop', 'single-loop'] as const)('在 %s 模式插入下一首，保持当前歌曲、进度及播放状态', async (mode) => {
    await player.setPlayQueue(songs.slice(0, 3))
    await player.setCurrentIndex(1)
    player.setPlayMode(mode)
    flush()
    player.audio.currentTime = 37
    const source = player.audio.src
    vi.mocked(player.audio.pause).mockClear()
    vi.mocked(player.audio.play).mockClear()
    vi.mocked(player.audio.load).mockClear()
    await player.addNextToPlayQueue(songs[3]!)
    flush()
    expect(ids()).toEqual(['a', 'b', 'd', 'c'])
    expect(player.currentSong()?.id).toBe('b')
    expect(player.audio.currentTime).toBe(37)
    expect(player.audio.src).toBe(source)
    expect(player.audio.play).not.toHaveBeenCalled()
    expect(player.audio.pause).not.toHaveBeenCalled()
    expect(player.audio.load).not.toHaveBeenCalled()
    expect(player.playMode()).toBe(mode)
    await player.prevNext(1, false)
    flush()
    expect(player.currentSong()?.id).toBe('d')
  })

  it('已有歌曲从当前位置移动，移除前面的曲目后仍指向正在播放的歌曲', async () => {
    await player.setPlayQueue(songs)
    await player.setCurrentIndex(2)
    flush()
    await player.addNextToPlayQueue(songs[0]!)
    flush()
    expect(ids()).toEqual(['b', 'c', 'a', 'd'])
    expect(player.currentIndex()).toBe(1)
    expect(player.currentSong()?.id).toBe('c')
    await player.addNextToPlayQueue(songs[0]!)
    flush()
    expect(ids()).toEqual(['b', 'c', 'a', 'd'])
  })

  it('当前曲目不重复加入，同 ID 不同音源视为不同歌曲', async () => {
    await player.setPlayQueue(songs.slice(0, 2))
    flush()
    const original = player.playQueue()
    await player.addNextToPlayQueue(songs[0]!)
    flush()
    expect(player.playQueue()).toBe(original)
    await player.addNextToPlayQueue({ ...songs[0]!, provider: 'netease' })
    flush()
    expect(player.playQueue().map(song => `${song.provider}:${song.id}`)).toEqual(['bili:a', 'netease:a', 'bili:b'])
  })

  it('随机模式重映射队列索引，并让指定歌曲成为实际下一首', async () => {
    await player.setPlayQueue(songs)
    await player.setCurrentIndex(2)
    player.setPlayMode('random')
    flush()
    const originalOrder = player.randomPlayQueue()!.map(index => player.playQueue()[index]!.id).filter(id => id !== 'a')
    await player.addNextToPlayQueue(songs[0]!)
    flush()
    const order = player.randomPlayQueue()!
    expect(new Set(order).size).toBe(4)
    expect([...order].sort()).toEqual([0, 1, 2, 3])
    expect(order.map(index => player.playQueue()[index]!.id).filter(id => id !== 'a')).toEqual(originalOrder)
    expect(player.playQueue()[order[(player.randomIndex()! + 1) % order.length]!]!.id).toBe('a')
    await player.prevNext(1, false)
    flush()
    expect(player.currentSong()?.id).toBe('a')
  })

  it('随机模式加入新曲目，保持全部索引有效', async () => {
    await player.setPlayQueue(songs.slice(0, 3))
    player.setPlayMode('random')
    flush()
    await player.addNextToPlayQueue(songs[3]!)
    flush()
    expect([...player.randomPlayQueue()!].sort()).toEqual([0, 1, 2, 3])
    await player.prevNext(1, false)
    flush()
    expect(player.currentSong()?.id).toBe('d')
  })

  it('空队列直接播放加入的歌曲', async () => {
    vi.mocked(player.audio.play).mockClear()
    await player.addNextToPlayQueue(songs[0]!)
    flush()
    expect(ids()).toEqual(['a'])
    expect(player.currentSong()?.id).toBe('a')
    expect(player.audio.play).toHaveBeenCalled()
  })
})
