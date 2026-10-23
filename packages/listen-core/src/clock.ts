import type { RoomSnapshot } from './protocol'

/** Server and client use monotonic clocks; their epochs do not have to match. */
export function roomPosition(state: RoomSnapshot, serverNow: number): number {
  const advancing = state.status === 'playing' || state.status === 'scheduled'
  const elapsed = advancing ? Math.max(0, serverNow - state.anchorServerTime) / 1000 : 0
  return Math.max(0, Math.min(state.track.duration, state.positionAtAnchor + elapsed * state.rate))
}

export class ListenClock {
  private samples: { rtt: number, offset: number }[] = []

  reset() { this.samples = [] }

  add(sentAt: number, receivedAt: number, serverTime: number) {
    const rtt = receivedAt - sentAt
    if (![sentAt, receivedAt, serverTime].every(Number.isFinite) || rtt < 0 || rtt > 10_000)
      return
    this.samples.push({ rtt, offset: serverTime - (sentAt + receivedAt) / 2 })
    this.samples = this.samples.slice(-12)
  }

  get estimate() {
    return this.samples.reduce<{ rtt: number, offset: number } | undefined>(
      (best, sample) => !best || sample.rtt < best.rtt ? sample : best, undefined,
    )
  }

  now(localNow: number) { return localNow + (this.estimate?.offset ?? 0) }
  get uncertaintyMs() { return this.estimate ? this.estimate.rtt / 2 : null }
}

export interface DriftSettings { threshold: number, cooldownMs: number }
export function shouldSeek(error: number, now: number, lastSeek: number, settings: DriftSettings) {
  return Number.isFinite(error) && Math.abs(error) > settings.threshold && now - lastSeek >= settings.cooldownMs
}

/** Experimental bounded drift policy; production playback retains shouldSeek(). */
export class DriftCorrection {
  private started?: number
  private lastSeek = -Infinity

  reset() { this.started = undefined }

  update(error: number, now: number, options: { strategy: 'seek' | 'rate', threshold: number, active: boolean }) {
    const idle = { rate: 1, seek: false }
    if (!options.active || !Number.isFinite(error) || !Number.isFinite(now)) { this.reset(); return idle }
    const magnitude = Math.abs(error)
    const seek = () => {
      this.reset()
      if (now - this.lastSeek < 2000) return idle
      this.lastSeek = now
      return { rate: 1, seek: true }
    }
    if (options.strategy === 'seek') { this.reset(); return magnitude > options.threshold ? seek() : idle }
    if (magnitude > 0.5) return seek()
    if (this.started !== undefined && magnitude <= 0.08) { this.reset(); return idle }
    if (this.started === undefined) {
      if (magnitude <= 0.15) return idle
      this.started = now
    }
    if (now - this.started >= 15_000) return seek()
    return { rate: error > 0 ? 0.98 : 1.02, seek: false }
  }
}
