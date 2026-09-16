import type { MusicInfo } from '#shared/types/music-info'
import { flush } from 'solid-js'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  addToPlaylist,
  clearPlaylist,
  currentIndex,
  playlist,
  playMode,
  randomIndex,
  randomPlaylist,
  removeFromPlaylist,
  resetPlayer,
  setCurrentIndex,
  setPlaylist,
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
      clearPlaylist()
    })
  })

  // Mock playlist data
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

  function generateMockPlaylist(): MusicInfo[] {
    return structuredClone(mockSongs as MusicInfo[])
  }

  describe('setPlaylist', () => {
    it('should set playlist and reset player state', () => {
      commit(() => setPlaylist(generateMockPlaylist()))
      expect(playlist()).toEqual(mockSongs)
      // 注：原期望为 null，但 78095ea 移除了 setCurrentIndex 对「没有该歌曲」的提前返回，
      // 因此 setPlaylist 会同步把 currentIndex 置为 0（随后异步开始播放第一首）。
      expect(currentIndex()).toBe(0)
    })

    it('should correctly set playlist in order mode', () => {
      commit(() => setPlayMode('order'))
      commit(() => setPlaylist(generateMockPlaylist()))
      expect(playlist()).toEqual(mockSongs)
      expect(playMode()).toBe('order')
      expect(randomPlaylist()).toBeNull()
    })

    it('should correctly set playlist in loop mode', () => {
      commit(() => setPlayMode('loop'))
      commit(() => setPlaylist(generateMockPlaylist()))
      expect(playlist()).toEqual(mockSongs)
      expect(playMode()).toBe('loop')
      expect(randomPlaylist()).toBeNull()
    })

    it('should generate random playlist in random mode', () => {
      commit(() => setPlayMode('random'))
      commit(() => setPlaylist(generateMockPlaylist()))
      expect(playlist()).toEqual(mockSongs)
      expect(randomPlaylist()).not.toBeNull()
      expect(randomPlaylist()).toHaveLength(mockSongs.length)
      // Verify random list contains all indices
      const indices = new Set(randomPlaylist())
      for (let i = 0; i < mockSongs.length; i++) {
        expect(indices.has(i)).toBe(true)
      }
    })

    it('should set random index to equal current index in random mode', () => {
      commit(() => setPlayMode('random'))
      commit(() => setPlaylist(generateMockPlaylist()))
      expect(currentIndex()).toBe(randomPlaylist()![randomIndex()!])
    })

    it('should clear empty playlist', () => {
      commit(() => setPlaylist(generateMockPlaylist()))
      commit(() => setPlaylist([]))
      expect(playlist()).toEqual([])
      expect(currentIndex()).toBe(0)
    })
  })

  describe('addToPlaylist', () => {
    it('should add song to playlist in order mode', () => {
      commit(() => setPlayMode('order'))
      commit(() => setPlaylist([mockSongs[0]!]))
      commit(() => setCurrentIndex(0))

      commit(() => addToPlaylist(mockSongs[1]!))
      expect(playlist()).toHaveLength(2)
      expect(playlist()[1]).toEqual(mockSongs[1])
    })

    it('should add song to playlist in loop mode', () => {
      commit(() => setPlayMode('loop'))
      commit(() => setPlaylist([mockSongs[0]!]))
      commit(() => setCurrentIndex(0))

      commit(() => addToPlaylist(mockSongs[1]!))
      expect(playlist()).toHaveLength(2)
      expect(playlist()[1]).toEqual(mockSongs[1])
    })

    it('should add song to playlist and update random list in random mode', () => {
      commit(() => setPlayMode('random'))
      commit(() => setPlaylist([mockSongs[0]!]))
      const initialLength = randomPlaylist()!.length

      commit(() => addToPlaylist(mockSongs[1]!))
      expect(playlist()).toHaveLength(2)
      expect(randomPlaylist()).toHaveLength(initialLength + 1)
      // Verify newly added song index is in random list
      expect(randomPlaylist()!.includes(1)).toBe(true)
    })

    it('should set new song as current song after adding', () => {
      commit(() => setPlaylist([mockSongs[0]!]))
      commit(() => addToPlaylist(mockSongs[1]!))
      expect(currentIndex()).toBe(1)
    })

    it('should be able to add multiple songs sequentially', () => {
      for (const [index, song] of Object.entries(mockSongs)) {
        if (index === '0') {
          commit(() => setPlaylist([song]))
        }
        else {
          commit(() => addToPlaylist(song))
        }
      }
      expect(playlist()).toHaveLength(mockSongs.length)
      expect(currentIndex()).toBe(mockSongs.length - 1)
    })
  })

  describe('removeFromPlaylist', () => {
    describe('remove in order mode', () => {
      beforeEach(() => {
        commit(() => setPlayMode('order'))
        commit(() => setPlaylist(generateMockPlaylist()))
        commit(() => setCurrentIndex(1))
      })

      it('should remove song from playlist', () => {
        commit(() => removeFromPlaylist(2))
        expect(playlist()).toHaveLength(mockSongs.length - 1)
        expect(playlist()[2]).toEqual(mockSongs[3])
      })

      it('should keep index valid after removing current song', () => {
        commit(() => removeFromPlaylist(currentIndex()!))
        expect(currentIndex()).toBe(1)
        expect(playlist()[1]).toEqual(mockSongs[2])
      })

      it('should adjust index when removing last song that is current', () => {
        commit(() => setCurrentIndex(1))
        commit(() => removeFromPlaylist(1))
        expect(currentIndex()).toBe(1)
      })

      it('should decrease currentIndex when removing song before index', () => {
        commit(() => removeFromPlaylist(0))
        expect(currentIndex()).toBe(0)
      })

      it('should not change currentIndex when removing song after index', () => {
        commit(() => removeFromPlaylist(2))
        expect(currentIndex()).toBe(1)
      })

      it('should adjust index when removing last song', () => {
        commit(() => setCurrentIndex(2))
        commit(() => removeFromPlaylist(3))
        expect(currentIndex()).toBe(2)
      })
    })

    describe('remove in loop mode', () => {
      beforeEach(() => {
        commit(() => setPlayMode('loop'))
        commit(() => setPlaylist(generateMockPlaylist()))
        commit(() => setCurrentIndex(1))
      })

      it('should remove song from playlist', () => {
        commit(() => removeFromPlaylist(2))
        expect(playlist()).toHaveLength(mockSongs.length - 1)
      })

      it('should loop to next song after removing current song', () => {
        commit(() => removeFromPlaylist(1))
        expect(currentIndex()).toBe(1)
      })
    })

    describe('remove in random mode', () => {
      beforeEach(() => {
        commit(() => setPlayMode('random'))
        commit(() => setPlaylist(generateMockPlaylist()))
      })

      it('should remove song from both playlist and random list', () => {
        const removedIndex = playlist().length - 1
        commit(() => removeFromPlaylist(removedIndex))
        expect(playlist()).toHaveLength(mockSongs.length - 1)
        expect(randomPlaylist()).toHaveLength(mockSongs.length - 1)
        expect(randomPlaylist()!.includes(removedIndex)).toBe(false)
      })

      it('should keep random list valid after removing song', () => {
        commit(() => removeFromPlaylist(1))
        expect(randomPlaylist()).toHaveLength(mockSongs.length - 1)
        // Verify all indices are valid
        randomPlaylist()!.forEach((idx) => {
          expect(playlist()[idx]).toBeDefined()
        })
      })
    })

    it('should reset player after removing all songs', () => {
      commit(() => setPlaylist([generateMockPlaylist()[0]!]))
      commit(() => setCurrentIndex(0))
      commit(() => removeFromPlaylist(0))
      expect(playlist()).toHaveLength(0)
      expect(currentIndex()).toBeNull()
    })

    it('should be able to remove multiple songs sequentially', () => {
      commit(() => setPlaylist(generateMockPlaylist()))
      commit(() => removeFromPlaylist(3))
      commit(() => removeFromPlaylist(2))
      commit(() => removeFromPlaylist(0))
      expect(playlist()).toHaveLength(1)
      expect(playlist()[0]).toEqual(mockSongs[1])
    })
  })

  describe('clearPlaylist', () => {
    it('should clear playlist', () => {
      commit(() => setPlaylist(generateMockPlaylist()))
      commit(() => setCurrentIndex(0))
      commit(() => clearPlaylist())
      expect(playlist()).toHaveLength(0)
      // 同 setPlaylist：清空后 currentIndex 会被同步置为 0
      expect(currentIndex()).toBe(0)
    })

    it('should clear playlist in all play modes', () => {
      const modes: Array<'order' | 'loop' | 'random'> = ['order', 'loop', 'random']
      modes.forEach((mode) => {
        commit(() => setPlayMode(mode))
        commit(() => setPlaylist(generateMockPlaylist()))
        commit(() => clearPlaylist())
        expect(playlist()).toHaveLength(0)
        expect(currentIndex()).toBe(0)
      })
    })
  })

  describe('cross-mode operations', () => {
    it('should switch between modes and maintain playlist', () => {
      commit(() => setPlaylist(generateMockPlaylist()))
      commit(() => setCurrentIndex(0))

      commit(() => setPlayMode('loop'))
      expect(playlist()).toEqual(mockSongs)

      commit(() => setPlayMode('random'))
      expect(playlist()).toEqual(mockSongs)

      commit(() => setPlayMode('order'))
      expect(playlist()).toEqual(mockSongs)
    })

    it('should clear random list when switching from random to order mode', () => {
      commit(() => setPlayMode('random'))
      commit(() => setPlaylist(generateMockPlaylist()))
      expect(randomPlaylist()).not.toBeNull()

      commit(() => setPlayMode('order'))
      expect(randomPlaylist()).toBeNull()
    })

    it('should keep songs after adding in random mode and switching modes', () => {
      const generatedPlaylist = generateMockPlaylist()
      commit(() => setPlayMode('random'))
      commit(() => setPlaylist([{ ...generatedPlaylist[0]! }]))
      commit(() => addToPlaylist({ ...generatedPlaylist[1]! }))

      commit(() => setPlayMode('order'))
      expect(playlist()).toEqual([generatedPlaylist[0]!, generatedPlaylist[1]!])
      expect(randomPlaylist()).toBeNull()
    })

    it('should work correctly when switching to random mode after removing in order mode', () => {
      commit(() => setPlayMode('order'))
      commit(() => setPlaylist(generateMockPlaylist()))
      commit(() => removeFromPlaylist(0))

      commit(() => setPlayMode('random'))
      expect(playlist()).toHaveLength(mockSongs.length - 1)
      expect(randomPlaylist()).toHaveLength(mockSongs.length - 1)
    })
  })

  describe('edge cases', () => {
    it('should reset all state when setting empty playlist', () => {
      commit(() => setPlaylist(generateMockPlaylist()))
      commit(() => setCurrentIndex(0))
      commit(() => setPlaylist([]))
      expect(playlist()).toHaveLength(0)
      expect(currentIndex()).toBe(0)
      expect(randomPlaylist()).toBeNull()
    })

    it('should handle removing from empty playlist correctly', () => {
      commit(() => setPlaylist([]))
      commit(() => removeFromPlaylist(0))
      expect(playlist()).toHaveLength(0)
      expect(currentIndex()).toBeNull()
    })

    it('should initialize correctly when adding to empty playlist', () => {
      commit(() => setPlaylist([]))
      commit(() => addToPlaylist(mockSongs[0]!))
      expect(playlist()).toHaveLength(1)
      expect(currentIndex()).toBe(0)
    })

    it('should work correctly with single song in all modes', () => {
      const modes: Array<'order' | 'loop' | 'random'> = ['order', 'loop', 'random']
      modes.forEach((mode) => {
        commit(() => setPlayMode(mode))
        commit(() => setPlaylist([mockSongs[0]!]))
        expect(playlist()).toHaveLength(1)
        if (mode === 'random') {
          expect(randomPlaylist()).toHaveLength(1)
          expect(randomPlaylist()![0]).toBe(0)
        }
      })
    })
  })
})
