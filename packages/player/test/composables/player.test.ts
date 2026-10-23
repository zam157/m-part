import type { MusicInfo } from '@m-part/music/types/music-info'
import { flush } from 'solid-js'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  addToPlayQueue,
  clearPlayQueue,
  currentIndex,
  playQueue,
  playMode,
  randomIndex,
  randomPlayQueue,
  removeFromPlayQueue,
  resetPlayer,
  setCurrentIndex,
  setPlayQueue,
  setPlayMode,
} from '~/composables/player'

/**
 * Solid 2 会把 signal 写入暂存起来，直到下一次 flush 才提交 —— `setCount(1)` 之后
 * 立刻读取仍然拿到旧值（见 `@solidjs/signals` 中 createEffect 的文档）。
 *
 * `player.ts` 的动作函数在第一个 `await` 之前完成状态写入，所以测试里把
 * 「动作 + 提交」包在一起，随后的断言即可看到已提交的状态。
 */
function commit<T>(action: () => T): T {
  const result = action()
  flush()
  return result
}

describe('player.ts', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    commit(() => {
      resetPlayer()
      clearPlayQueue()
    })
  })

  // Mock play queue data
  const mockSongs: Readonly<MusicInfo[]> = Object.freeze([
    {
      provider: 'bili',
      id: 'BV16G411973A',
      title: 'Song 1',
      artist: 'Artist A',
      duration: 1992,
      coverUrl: 'http://i2.hdslb.com/bfs/archive/e4b39b75b141e15ec5eb197b92b8e3f9e768a609.jpg',
      album: '',
    },
    {
      provider: 'bili',
      id: 'BV16G411973B',
      title: 'Song 1',
      artist: 'Artist A',
      duration: 1992,
      coverUrl: 'http://i2.hdslb.com/bfs/archive/e4b39b75b141e15ec5eb197b92b8e3f9e768a609.jpg',
      album: '',
    },
    {
      provider: 'bili',
      id: 'BV16G411973C',
      title: 'Song 1',
      artist: 'Artist A',
      duration: 1992,
      coverUrl: 'http://i2.hdslb.com/bfs/archive/e4b39b75b141e15ec5eb197b92b8e3f9e768a609.jpg',
      album: '',
    },
    {
      provider: 'bili',
      id: 'BV16G411973D',
      title: 'Song 1',
      artist: 'Artist A',
      duration: 1992,
      coverUrl: 'http://i2.hdslb.com/bfs/archive/e4b39b75b141e15ec5eb197b92b8e3f9e768a609.jpg',
      album: '',
    },
  ])

  function generateMockPlayQueue(): MusicInfo[] {
    return structuredClone(mockSongs as MusicInfo[])
  }

  describe('setPlayQueue', () => {
    it('should set play queue and reset player state', () => {
      commit(() => setPlayQueue(generateMockPlayQueue()))
      expect(playQueue()).toEqual(mockSongs)
      // 注：原期望为 null，但 78095ea 移除了 setCurrentIndex 对「没有该歌曲」的提前返回，
      // 因此 setPlayQueue 会同步把 currentIndex 置为 0（随后异步开始播放第一首）。
      expect(currentIndex()).toBe(0)
    })

    it('should correctly set play queue in order mode', () => {
      commit(() => setPlayMode('order'))
      commit(() => setPlayQueue(generateMockPlayQueue()))
      expect(playQueue()).toEqual(mockSongs)
      expect(playMode()).toBe('order')
      expect(randomPlayQueue()).toBeNull()
    })

    it('should correctly set play queue in loop mode', () => {
      commit(() => setPlayMode('loop'))
      commit(() => setPlayQueue(generateMockPlayQueue()))
      expect(playQueue()).toEqual(mockSongs)
      expect(playMode()).toBe('loop')
      expect(randomPlayQueue()).toBeNull()
    })

    it('should generate random play queue in random mode', () => {
      commit(() => setPlayMode('random'))
      commit(() => setPlayQueue(generateMockPlayQueue()))
      expect(playQueue()).toEqual(mockSongs)
      expect(randomPlayQueue()).not.toBeNull()
      expect(randomPlayQueue()).toHaveLength(mockSongs.length)
      // Verify random list contains all indices
      const indices = new Set(randomPlayQueue())
      for (let i = 0; i < mockSongs.length; i++) {
        expect(indices.has(i)).toBe(true)
      }
    })

    it('should set random index to equal current index in random mode', () => {
      commit(() => setPlayMode('random'))
      commit(() => setPlayQueue(generateMockPlayQueue()))
      expect(currentIndex()).toBe(randomPlayQueue()![randomIndex()!])
    })

    it('should clear empty play queue', () => {
      commit(() => setPlayQueue(generateMockPlayQueue()))
      commit(() => setPlayQueue([]))
      expect(playQueue()).toEqual([])
      expect(currentIndex()).toBe(0)
    })
  })

  describe('addToPlayQueue', () => {
    it('should add song to play queue in order mode', () => {
      commit(() => setPlayMode('order'))
      commit(() => setPlayQueue([mockSongs[0]!]))
      commit(() => setCurrentIndex(0))

      commit(() => addToPlayQueue(mockSongs[1]!))
      expect(playQueue()).toHaveLength(2)
      expect(playQueue()[1]).toEqual(mockSongs[1])
    })

    it('should add song to play queue in loop mode', () => {
      commit(() => setPlayMode('loop'))
      commit(() => setPlayQueue([mockSongs[0]!]))
      commit(() => setCurrentIndex(0))

      commit(() => addToPlayQueue(mockSongs[1]!))
      expect(playQueue()).toHaveLength(2)
      expect(playQueue()[1]).toEqual(mockSongs[1])
    })

    it('should add song to play queue and update random list in random mode', () => {
      commit(() => setPlayMode('random'))
      commit(() => setPlayQueue([mockSongs[0]!]))
      const initialLength = randomPlayQueue()!.length

      commit(() => addToPlayQueue(mockSongs[1]!))
      expect(playQueue()).toHaveLength(2)
      expect(randomPlayQueue()).toHaveLength(initialLength + 1)
      // Verify newly added song index is in random list
      expect(randomPlayQueue()!.includes(1)).toBe(true)
    })

    it('should set new song as current song after adding', () => {
      commit(() => setPlayQueue([mockSongs[0]!]))
      commit(() => addToPlayQueue(mockSongs[1]!))
      expect(currentIndex()).toBe(1)
    })

    it('should be able to add multiple songs sequentially', () => {
      for (const [index, song] of Object.entries(mockSongs)) {
        if (index === '0') {
          commit(() => setPlayQueue([song]))
        }
        else {
          commit(() => addToPlayQueue(song))
        }
      }
      expect(playQueue()).toHaveLength(mockSongs.length)
      expect(currentIndex()).toBe(mockSongs.length - 1)
    })
  })

  describe('removeFromPlayQueue', () => {
    describe('remove in order mode', () => {
      beforeEach(() => {
        commit(() => setPlayMode('order'))
        commit(() => setPlayQueue(generateMockPlayQueue()))
        commit(() => setCurrentIndex(1))
      })

      it('should remove song from play queue', () => {
        commit(() => removeFromPlayQueue(2))
        expect(playQueue()).toHaveLength(mockSongs.length - 1)
        expect(playQueue()[2]).toEqual(mockSongs[3])
      })

      it('should keep index valid after removing current song', () => {
        commit(() => removeFromPlayQueue(currentIndex()!))
        expect(currentIndex()).toBe(1)
        expect(playQueue()[1]).toEqual(mockSongs[2])
      })

      it('should adjust index when removing last song that is current', () => {
        commit(() => setCurrentIndex(1))
        commit(() => removeFromPlayQueue(1))
        expect(currentIndex()).toBe(1)
      })

      it('should decrease currentIndex when removing song before index', () => {
        commit(() => removeFromPlayQueue(0))
        expect(currentIndex()).toBe(0)
      })

      it('should not change currentIndex when removing song after index', () => {
        commit(() => removeFromPlayQueue(2))
        expect(currentIndex()).toBe(1)
      })

      it('should adjust index when removing last song', () => {
        commit(() => setCurrentIndex(2))
        commit(() => removeFromPlayQueue(3))
        expect(currentIndex()).toBe(2)
      })
    })

    describe('remove in loop mode', () => {
      beforeEach(() => {
        commit(() => setPlayMode('loop'))
        commit(() => setPlayQueue(generateMockPlayQueue()))
        commit(() => setCurrentIndex(1))
      })

      it('should remove song from play queue', () => {
        commit(() => removeFromPlayQueue(2))
        expect(playQueue()).toHaveLength(mockSongs.length - 1)
      })

      it('should loop to next song after removing current song', () => {
        commit(() => removeFromPlayQueue(1))
        expect(currentIndex()).toBe(1)
      })
    })

    describe('remove in random mode', () => {
      beforeEach(() => {
        commit(() => setPlayMode('random'))
        commit(() => setPlayQueue(generateMockPlayQueue()))
      })

      it('should remove song from both play queue and random list', () => {
        const removedIndex = playQueue().length - 1
        commit(() => removeFromPlayQueue(removedIndex))
        expect(playQueue()).toHaveLength(mockSongs.length - 1)
        expect(randomPlayQueue()).toHaveLength(mockSongs.length - 1)
        expect(randomPlayQueue()!.includes(removedIndex)).toBe(false)
      })

      it('should keep random list valid after removing song', () => {
        commit(() => removeFromPlayQueue(1))
        expect(randomPlayQueue()).toHaveLength(mockSongs.length - 1)
        // Verify all indices are valid
        randomPlayQueue()!.forEach((idx) => {
          expect(playQueue()[idx]).toBeDefined()
        })
      })
    })

    it('should reset player after removing all songs', () => {
      commit(() => setPlayQueue([generateMockPlayQueue()[0]!]))
      commit(() => setCurrentIndex(0))
      commit(() => removeFromPlayQueue(0))
      expect(playQueue()).toHaveLength(0)
      expect(currentIndex()).toBeNull()
    })

    it('should be able to remove multiple songs sequentially', () => {
      commit(() => setPlayQueue(generateMockPlayQueue()))
      commit(() => removeFromPlayQueue(3))
      commit(() => removeFromPlayQueue(2))
      commit(() => removeFromPlayQueue(0))
      expect(playQueue()).toHaveLength(1)
      expect(playQueue()[0]).toEqual(mockSongs[1])
    })
  })

  describe('clearPlayQueue', () => {
    it('should clear play queue', () => {
      commit(() => setPlayQueue(generateMockPlayQueue()))
      commit(() => setCurrentIndex(0))
      commit(() => clearPlayQueue())
      expect(playQueue()).toHaveLength(0)
      // 同 setPlayQueue：清空后 currentIndex 会被同步置为 0
      expect(currentIndex()).toBe(0)
    })

    it('should clear play queue in all play modes', () => {
      const modes: Array<'order' | 'loop' | 'random'> = ['order', 'loop', 'random']
      modes.forEach((mode) => {
        commit(() => setPlayMode(mode))
        commit(() => setPlayQueue(generateMockPlayQueue()))
        commit(() => clearPlayQueue())
        expect(playQueue()).toHaveLength(0)
        expect(currentIndex()).toBe(0)
      })
    })
  })

  describe('cross-mode operations', () => {
    it('should switch between modes and maintain play queue', () => {
      commit(() => setPlayQueue(generateMockPlayQueue()))
      commit(() => setCurrentIndex(0))

      commit(() => setPlayMode('loop'))
      expect(playQueue()).toEqual(mockSongs)

      commit(() => setPlayMode('random'))
      expect(playQueue()).toEqual(mockSongs)

      commit(() => setPlayMode('order'))
      expect(playQueue()).toEqual(mockSongs)
    })

    it('should clear random list when switching from random to order mode', () => {
      commit(() => setPlayMode('random'))
      commit(() => setPlayQueue(generateMockPlayQueue()))
      expect(randomPlayQueue()).not.toBeNull()

      commit(() => setPlayMode('order'))
      expect(randomPlayQueue()).toBeNull()
    })

    it('should keep songs after adding in random mode and switching modes', () => {
      const generatedPlayQueue = generateMockPlayQueue()
      commit(() => setPlayMode('random'))
      commit(() => setPlayQueue([{ ...generatedPlayQueue[0]! }]))
      commit(() => addToPlayQueue({ ...generatedPlayQueue[1]! }))

      commit(() => setPlayMode('order'))
      expect(playQueue()).toEqual([generatedPlayQueue[0]!, generatedPlayQueue[1]!])
      expect(randomPlayQueue()).toBeNull()
    })

    it('should work correctly when switching to random mode after removing in order mode', () => {
      commit(() => setPlayMode('order'))
      commit(() => setPlayQueue(generateMockPlayQueue()))
      commit(() => removeFromPlayQueue(0))

      commit(() => setPlayMode('random'))
      expect(playQueue()).toHaveLength(mockSongs.length - 1)
      expect(randomPlayQueue()).toHaveLength(mockSongs.length - 1)
    })
  })

  describe('edge cases', () => {
    it('should reset all state when setting empty play queue', () => {
      commit(() => setPlayQueue(generateMockPlayQueue()))
      commit(() => setCurrentIndex(0))
      commit(() => setPlayQueue([]))
      expect(playQueue()).toHaveLength(0)
      expect(currentIndex()).toBe(0)
      expect(randomPlayQueue()).toBeNull()
    })

    it('should handle removing from empty play queue correctly', () => {
      commit(() => setPlayQueue([]))
      commit(() => removeFromPlayQueue(0))
      expect(playQueue()).toHaveLength(0)
      expect(currentIndex()).toBeNull()
    })

    it('should initialize correctly when adding to empty play queue', () => {
      commit(() => setPlayQueue([]))
      commit(() => addToPlayQueue(mockSongs[0]!))
      expect(playQueue()).toHaveLength(1)
      expect(currentIndex()).toBe(0)
    })

    it('should work correctly with single song in all modes', () => {
      const modes: Array<'order' | 'loop' | 'random'> = ['order', 'loop', 'random']
      modes.forEach((mode) => {
        commit(() => setPlayMode(mode))
        commit(() => setPlayQueue([mockSongs[0]!]))
        expect(playQueue()).toHaveLength(1)
        if (mode === 'random') {
          expect(randomPlayQueue()).toHaveLength(1)
          expect(randomPlayQueue()![0]).toBe(0)
        }
      })
    })
  })
})
