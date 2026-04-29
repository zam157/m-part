import type { PlayListItem } from '~/composables/player'
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

describe('player.ts', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    resetPlayer()
    clearPlaylist()
  })

  // Mock playlist data
  const mockSongs: Readonly<PlayListItem[]> = Object.freeze([
    { name: 'Song 1', src: 'song1.mp3', artist: 'Artist 1' },
    { name: 'Song 2', src: 'song2.mp3', artist: 'Artist 2' },
    { name: 'Song 3', src: 'song3.mp3', artist: 'Artist 3' },
    { name: 'Song 4', src: 'song4.mp3', artist: 'Artist 4' },
  ])

  function generateMockPlaylist(): PlayListItem[] {
    return structuredClone(mockSongs as PlayListItem[])
  }

  describe('setPlaylist', () => {
    it('should set playlist and reset player state', () => {
      setPlaylist(generateMockPlaylist())
      expect(playlist.value).toEqual(mockSongs)
      expect(currentIndex.value).toBeNull()
    })

    it('should correctly set playlist in order mode', () => {
      setPlayMode('order')
      setPlaylist(generateMockPlaylist())
      expect(playlist.value).toEqual(mockSongs)
      expect(playMode.value).toBe('order')
      expect(randomPlaylist.value).toBeNull()
    })

    it('should correctly set playlist in loop mode', () => {
      setPlayMode('loop')
      setPlaylist(generateMockPlaylist())
      expect(playlist.value).toEqual(mockSongs)
      expect(playMode.value).toBe('loop')
      expect(randomPlaylist.value).toBeNull()
    })

    it('should generate random playlist in random mode', () => {
      setPlayMode('random')
      setPlaylist(generateMockPlaylist())
      expect(playlist.value).toEqual(mockSongs)
      expect(randomPlaylist.value).not.toBeNull()
      expect(randomPlaylist.value).toHaveLength(mockSongs.length)
      // Verify random list contains all indices
      const indices = new Set(randomPlaylist.value)
      for (let i = 0; i < mockSongs.length; i++) {
        expect(indices.has(i)).toBe(true)
      }
    })

    it('should set random index to equal current index in random mode', () => {
      setPlayMode('random')
      setPlaylist(generateMockPlaylist())
      expect(currentIndex.value).toBe(randomPlaylist.value![randomIndex.value!])
    })

    it('should clear empty playlist', () => {
      setPlaylist(generateMockPlaylist())
      setPlaylist([])
      expect(playlist.value).toEqual([])
      expect(currentIndex.value).toBeNull()
    })
  })

  describe('addToPlaylist', () => {
    it('should add song to playlist in order mode', () => {
      setPlayMode('order')
      setPlaylist([mockSongs[0]!])
      setCurrentIndex(0)

      addToPlaylist(mockSongs[1]!)
      expect(playlist.value).toHaveLength(2)
      expect(playlist.value[1]).toEqual(mockSongs[1])
    })

    it('should add song to playlist in loop mode', () => {
      setPlayMode('loop')
      setPlaylist([mockSongs[0]!])
      setCurrentIndex(0)

      addToPlaylist(mockSongs[1]!)
      expect(playlist.value).toHaveLength(2)
      expect(playlist.value[1]).toEqual(mockSongs[1])
    })

    it('should add song to playlist and update random list in random mode', () => {
      setPlayMode('random')
      setPlaylist([mockSongs[0]!])
      const initialLength = randomPlaylist.value!.length

      addToPlaylist(mockSongs[1]!)
      expect(playlist.value).toHaveLength(2)
      expect(randomPlaylist.value).toHaveLength(initialLength + 1)
      // Verify newly added song index is in random list
      expect(randomPlaylist.value!.includes(1)).toBe(true)
    })

    it('should set new song as current song after adding', () => {
      setPlaylist([mockSongs[0]!])
      addToPlaylist(mockSongs[1]!)
      expect(currentIndex.value).toBe(1)
    })

    it('should be able to add multiple songs sequentially', () => {
      setPlaylist([mockSongs[0]!])
      addToPlaylist(mockSongs[1]!)
      addToPlaylist(mockSongs[2]!)
      addToPlaylist(mockSongs[3]!)
      expect(playlist.value).toHaveLength(4)
      expect(currentIndex.value).toBe(3)
    })
  })

  describe('removeFromPlaylist', () => {
    describe('remove in order mode', () => {
      beforeEach(() => {
        setPlayMode('order')
        setPlaylist(generateMockPlaylist())
        setCurrentIndex(1)
      })

      it('should remove song from playlist', () => {
        removeFromPlaylist(2)
        expect(playlist.value).toHaveLength(3)
        expect(playlist.value[2]).toEqual(mockSongs[3])
      })

      it('should keep index valid after removing current song', () => {
        removeFromPlaylist(currentIndex.value!)
        expect(currentIndex.value).toBe(1)
        expect(playlist.value[1]).toEqual(mockSongs[2])
      })

      it('should adjust index when removing last song that is current', () => {
        setCurrentIndex(3)
        removeFromPlaylist(3)
        expect(currentIndex.value).toBe(0)
      })

      it('should decrease currentIndex when removing song before index', () => {
        removeFromPlaylist(0)
        expect(currentIndex.value).toBe(0)
      })

      it('should not change currentIndex when removing song after index', () => {
        removeFromPlaylist(2)
        expect(currentIndex.value).toBe(1)
      })

      it('should adjust index when removing last song', () => {
        setCurrentIndex(2)
        removeFromPlaylist(3)
        expect(currentIndex.value).toBe(2)
      })
    })

    describe('remove in loop mode', () => {
      beforeEach(() => {
        setPlayMode('loop')
        setPlaylist(generateMockPlaylist())
        setCurrentIndex(1)
      })

      it('should remove song from playlist', () => {
        removeFromPlaylist(2)
        expect(playlist.value).toHaveLength(3)
      })

      it('should loop to next song after removing current song', () => {
        removeFromPlaylist(1)
        expect(currentIndex.value).toBe(1)
      })
    })

    describe('remove in random mode', () => {
      beforeEach(() => {
        setPlayMode('random')
        setPlaylist(generateMockPlaylist())
      })

      it('should remove song from both playlist and random list', () => {
        const removedIndex = playlist.value.length - 1
        removeFromPlaylist(removedIndex)
        expect(playlist.value).toHaveLength(3)
        expect(randomPlaylist.value).toHaveLength(3)
        expect(randomPlaylist.value!.includes(removedIndex)).toBe(false)
      })

      it('should keep random list valid after removing song', () => {
        removeFromPlaylist(1)
        expect(randomPlaylist.value).toHaveLength(3)
        // Verify all indices are valid
        randomPlaylist.value!.forEach((idx) => {
          expect(playlist.value[idx]).toBeDefined()
        })
      })
    })

    it('should reset player after removing all songs', () => {
      setPlaylist([generateMockPlaylist()[0]!])
      setCurrentIndex(0)
      removeFromPlaylist(0)
      expect(playlist.value).toHaveLength(0)
      expect(currentIndex.value).toBeNull()
    })

    it('should be able to remove multiple songs sequentially', () => {
      setPlaylist(generateMockPlaylist())
      removeFromPlaylist(3)
      removeFromPlaylist(2)
      removeFromPlaylist(0)
      expect(playlist.value).toHaveLength(1)
      expect(playlist.value[0]).toEqual(mockSongs[1])
    })
  })

  describe('clearPlaylist', () => {
    it('should clear playlist', () => {
      setPlaylist(generateMockPlaylist())
      setCurrentIndex(0)
      clearPlaylist()
      expect(playlist.value).toHaveLength(0)
      expect(currentIndex.value).toBeNull()
    })

    it('should clear playlist in all play modes', () => {
      const modes: Array<'order' | 'loop' | 'random'> = ['order', 'loop', 'random']
      modes.forEach((mode) => {
        setPlayMode(mode)
        setPlaylist(generateMockPlaylist())
        clearPlaylist()
        expect(playlist.value).toHaveLength(0)
        expect(currentIndex.value).toBeNull()
      })
    })
  })

  describe('cross-mode operations', () => {
    it('should switch between modes and maintain playlist', () => {
      setPlaylist(generateMockPlaylist())
      setCurrentIndex(0)

      setPlayMode('loop')
      expect(playlist.value).toEqual(mockSongs)

      setPlayMode('random')
      expect(playlist.value).toEqual(mockSongs)

      setPlayMode('order')
      expect(playlist.value).toEqual(mockSongs)
    })

    it('should clear random list when switching from random to order mode', () => {
      setPlayMode('random')
      setPlaylist(generateMockPlaylist())
      expect(randomPlaylist.value).not.toBeNull()

      setPlayMode('order')
      expect(randomPlaylist.value).toBeNull()
    })

    it('should keep songs after adding in random mode and switching modes', () => {
      const generatedPlaylist = generateMockPlaylist()
      setPlayMode('random')
      setPlaylist([{ ...generatedPlaylist[0]! }])
      addToPlaylist({ ...generatedPlaylist[1]! })

      setPlayMode('order')
      expect(playlist.value).toEqual([generatedPlaylist[0]!, generatedPlaylist[1]!])
      expect(randomPlaylist.value).toBeNull()
    })

    it('should work correctly when switching to random mode after removing in order mode', () => {
      setPlayMode('order')
      setPlaylist(generateMockPlaylist())
      removeFromPlaylist(0)

      setPlayMode('random')
      expect(playlist.value).toHaveLength(3)
      expect(randomPlaylist.value).toHaveLength(3)
    })
  })

  describe('edge cases', () => {
    it('should reset all state when setting empty playlist', () => {
      setPlaylist(generateMockPlaylist())
      setCurrentIndex(0)
      setPlaylist([])
      expect(playlist.value).toHaveLength(0)
      expect(currentIndex.value).toBeNull()
      expect(randomPlaylist.value).toBeNull()
    })

    it('should handle removing from empty playlist correctly', () => {
      setPlaylist([])
      removeFromPlaylist(0)
      expect(playlist.value).toHaveLength(0)
      expect(currentIndex.value).toBeNull()
    })

    it('should initialize correctly when adding to empty playlist', () => {
      setPlaylist([])
      addToPlaylist(mockSongs[0]!)
      expect(playlist.value).toHaveLength(1)
      expect(currentIndex.value).toBe(0)
    })

    it('should work correctly with single song in all modes', () => {
      const modes: Array<'order' | 'loop' | 'random'> = ['order', 'loop', 'random']
      modes.forEach((mode) => {
        setPlayMode(mode)
        setPlaylist([mockSongs[0]!])
        expect(playlist.value).toHaveLength(1)
        if (mode === 'random') {
          expect(randomPlaylist.value).toHaveLength(1)
          expect(randomPlaylist.value![0]).toBe(0)
        }
      })
    })
  })
})
