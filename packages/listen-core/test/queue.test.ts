import { describe, expect, it } from 'vitest'
import { insertQueueTracks, remapQueueOrder, trackKey, uniqueTracks } from '../src/queue'
const track = (id: string, extra = {}) => ({ provider: 'bili', id, ...extra })
const ids = (tracks: ReturnType<typeof track>[]) => tracks.map(trackKey)

describe('shared queue identity and insertion', () => {
  it('deduplicates cloned entries by provider and ID, keeping different providers and CIDs distinct', () => {
    expect(ids(uniqueTracks([track('1'), track('1'), track('1', { provider: 'qq' }), track('BV:1'), track('BV:2')]))).toEqual(['bili:1', 'qq:1', 'bili:BV:1', 'bili:BV:2'])
  })
  it('repairs duplicate queue entries and preserves the actual current object and stable room ID', () => {
    const current = track('b', { queueItemId: 'current', title: '正在播放' })
    const result = insertQueueTracks([track('b'), track('a'), current, track('c'), track('a')], [track('a'), track('a')], 2, 'next')
    expect(ids(result.queue)).toEqual(['bili:b', 'bili:a', 'bili:c'])
    expect(result.queue[result.currentIndex!]).toBe(current)
    expect(result.selected[0]).toBe(result.queue[1])
  })
  it('repeatedly inserts a playlist after the current track without duplicates or reordering the remainder', () => {
    const original = ['a', 'b', 'c', 'd'].map(id => track(id))
    const first = insertQueueTracks(original, [track('d'), track('b'), track('a'), track('new'), track('d')], 1, 'next')
    expect(ids(first.queue)).toEqual(['bili:b', 'bili:d', 'bili:a', 'bili:new', 'bili:c'])
    const second = insertQueueTracks(first.queue, [track('d'), track('b'), track('a'), track('new')], first.currentIndex, 'next')
    expect(second.queue).toEqual(first.queue)
    expect(second.queue[0]).toBe(original[1])
  })
  it('handles append and empty queues, preserving selection order', () => {
    const original = [track('a')]
    expect(ids(insertQueueTracks(original, [track('a'), track('b'), track('b')], 0, 'end').queue)).toEqual(['bili:a', 'bili:b'])
    const result = insertQueueTracks([], [track('a'), track('a'), track('b')], null, 'next')
    expect(ids(result.queue)).toEqual(['bili:a', 'bili:b'])
    expect(result.currentIndex).toBeNull()
  })
  it('remaps shuffle identities without losing entries when duplicates collapse and new tracks arrive', () => {
    const previous = ['a', 'b', 'a', 'c'].map(id => track(id))
    const next = ['c', 'a', 'b', 'd'].map(id => track(id))
    expect(remapQueueOrder(previous, next, [3, 2, 0, 1])).toEqual([0, 1, 2, 3])
  })
})
