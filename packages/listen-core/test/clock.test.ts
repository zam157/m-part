import type { RoomSnapshot } from '../src/protocol'
import { describe, expect, it } from 'vitest'
import { ListenClock, roomPosition, shouldSeek } from '../src/clock'

describe('monotonic calibration and progress', () => {
  it('estimates clock offset from a round trip and prefers recent low-RTT samples', () => {
    const clock = new ListenClock()
    clock.add(100, 120, 1_110)
    expect(clock.now(200)).toBe(1_200)
    expect(clock.uncertaintyMs).toBe(10)
    clock.add(200, 400, 1_500)
    expect(clock.now(200)).toBe(1_200)
    clock.reset()
    expect(clock.uncertaintyMs).toBeNull()
  })
  it('ignores invalid samples and retires old clock estimates', () => {
    const clock = new ListenClock()
    clock.add(100, 90, 1_000); clock.add(100, Infinity, 1_000)
    expect(clock.estimate).toBeUndefined()
    clock.add(0, 2, 1_001)
    for (let i = 0; i < 12; i++) clock.add(100, 104, 2_102)
    expect(clock.now(100)).toBe(2_100)
  })
  const state = { track: { duration: 90 }, positionAtAnchor: 10, anchorServerTime: 1_000, rate: 1, status: 'scheduled' } as RoomSnapshot
  it('does not run the timeline backwards before scheduled start and clamps at the end', () => {
    expect(roomPosition(state, 0)).toBe(10)
    expect(roomPosition(state, 3_000)).toBe(12)
    expect(roomPosition(state, 999_999)).toBe(90)
    expect(roomPosition({ ...state, status: 'paused' }, 3_000)).toBe(10)
  })
  it('limits seek corrections by threshold and cooldown', () => {
    const settings = { threshold: 0.3, cooldownMs: 2_000 }
    expect(shouldSeek(0.2, 2_000, 0, settings)).toBe(false)
    expect(shouldSeek(0.5, 1_000, 0, settings)).toBe(false)
    expect(shouldSeek(-0.5, 2_000, 0, settings)).toBe(true)
    expect(shouldSeek(NaN, 2_000, 0, settings)).toBe(false)
  })
})
