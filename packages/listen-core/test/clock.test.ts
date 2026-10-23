import type { RoomSnapshot } from '../src/protocol'
import { describe, expect, it } from 'vitest'
import { DriftCorrection, ListenClock, roomPosition, shouldSeek } from '../src/clock'

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

describe('bounded experimental rate correction', () => {
  it('preserves default seek threshold and cooldown', () => {
    const policy = new DriftCorrection()
    const options = { strategy: 'seek' as const, threshold: 0.3, active: true }
    expect(policy.update(0.2, 0, options)).toEqual({ rate: 1, seek: false })
    expect(policy.update(0.4, 0, options)).toEqual({ rate: 1, seek: true })
    expect(policy.update(0.4, 1000, options).seek).toBe(false)
    expect(policy.update(0.4, 2000, options).seek).toBe(true)
  })
  it('corrects small drift with limited local rates and exits with hysteresis', () => {
    const policy = new DriftCorrection()
    const options = { strategy: 'rate' as const, threshold: 0.3, active: true }
    expect(policy.update(0.1, 0, options).rate).toBe(1)
    expect(policy.update(-0.3, 1000, options).rate).toBe(1.02)
    expect(policy.update(-0.1, 2000, options).rate).toBe(1.02)
    expect(policy.update(-0.07, 3000, options).rate).toBe(1)
    expect(policy.update(0.3, 4000, options).rate).toBe(0.98)
  })
  it('falls back to seek after at most 15 seconds or for large errors', () => {
    const policy = new DriftCorrection()
    const options = { strategy: 'rate' as const, threshold: 0.3, active: true }
    expect(policy.update(0.3, 0, options).rate).toBe(0.98)
    expect(policy.update(0.2, 15_000, options)).toEqual({ rate: 1, seek: true })
    expect(policy.update(0.7, 18_000, options).seek).toBe(true)
  })
  it('resets the local rate after cancellation, pause or invalid measurements', () => {
    const policy = new DriftCorrection()
    const options = { strategy: 'rate' as const, threshold: 0.3, active: true }
    policy.update(-0.3, 0, options)
    expect(policy.update(-0.3, 1000, { ...options, active: false }).rate).toBe(1)
    expect(policy.update(NaN, 2000, options).rate).toBe(1)
    policy.reset()
    expect(policy.update(-0.1, 3000, options).rate).toBe(1)
  })
})
