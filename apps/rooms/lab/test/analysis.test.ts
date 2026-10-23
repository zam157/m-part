import type { Telemetry } from '../client/session'
import { expect, it } from 'vitest'
import { compareRecordings } from '../analyze'

const sample = (patch: Partial<Telemetry> = {}): Telemetry => ({
  localTime: 1_000, serverTime: 1_000, position: 1, target: 1, errorMs: 0, uncertaintyMs: 2,
  connected: true, status: 'following', revision: 1, playbackId: 'one', seeks: 0, steady: true, ...patch,
})
it('projects samples to a common calibrated instant instead of counting sample skew as drift', () => {
  const result = compareRecordings({ samples: [sample()], events: [] }, { samples: [sample({ serverTime: 1_500, position: 1.6 })], events: [] })
  expect(result.p95Ms).toBeCloseTo(100)
  expect(result.clockUncertaintyP95Ms).toBe(4)
})
it('excludes different playback/control instances while retaining failed and away coverage', () => {
  const recording = { samples: [sample(), sample({ localTime: 1_500, status: 'blocked', steady: false }), sample({ localTime: 2_000, status: 'away', steady: false })], events: [] }
  const result = compareRecordings(recording, { samples: [sample({ playbackId: 'another' })], events: [] })
  expect(result.pairedSteadySamples).toBe(0)
  expect(result.p95Ms).toBeNull()
  expect(result.participants[0]!.states).toEqual({ following: 1, blocked: 1, away: 1 })
  expect(result.participants[0]!.durationsMs.blocked).toBe(500)
})
it('accounts for local correction rates when projecting and reports correction time', () => {
  const a = { samples: [sample(), sample({ localTime: 2000 })], events: [] }
  const b = { samples: [sample({ serverTime: 1500, position: 1.51, playbackRate: 1.02 }), sample({ localTime: 2000, playbackRate: 1 })], events: [] }
  const result = compareRecordings(a, b)
  expect(result.p95Ms).toBeCloseTo(0)
  expect(result.participants[1]!.rateCorrectionMs).toBe(1000)
})
