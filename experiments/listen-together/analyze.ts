import type { Telemetry } from './client/session'
import { readFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'

export interface Recording { samples: Telemetry[], events: { at: number, event: string }[] }
const percentile = (values: number[], quantile: number) => values.length ? values[Math.floor((values.length - 1) * quantile)]! : null

/** Pair only nearby, steady samples of the same control/playback instance. */
export function compareRecordings(a: Recording, b: Recording) {
  const differences: number[] = []
  const uncertainties: number[] = []
  const used = new Set<number>()
  for (const left of a.samples) {
    if (!left.steady || !left.connected || left.status !== 'following') continue
    let best = -1
    let distance = 750
    for (let i = 0; i < b.samples.length; i++) {
      const right = b.samples[i]!
      const delta = Math.abs(left.serverTime - right.serverTime)
      if (!used.has(i) && right.steady && right.connected && right.status === 'following'
        && left.playbackId === right.playbackId && left.revision === right.revision && delta <= distance) {
        best = i; distance = delta
      }
    }
    if (best < 0) continue
    used.add(best)
    const right = b.samples[best]!
    // Project onto left's calibrated instant, rather than subtracting arrival times.
    differences.push(Math.abs(left.position - (right.position + (left.serverTime - right.serverTime) / 1000)) * 1000)
    uncertainties.push((left.uncertaintyMs ?? 0) + (right.uncertaintyMs ?? 0))
  }
  differences.sort((x, y) => x - y)
  uncertainties.sort((x, y) => x - y)
  const summarize = (recording: Recording) => {
    const states: Record<string, number> = {}
    const durations: Record<string, number> = {}
    const recoveries: { trigger: string, durationMs: number | null }[] = []
    for (let i = 0; i < recording.samples.length; i++) {
      const sample = recording.samples[i]!
      const key = sample.connected ? sample.status : 'disconnected'
      states[key] = (states[key] ?? 0) + 1
      const next = recording.samples[i + 1]
      if (next) durations[key] = (durations[key] ?? 0) + Math.max(0, next.localTime - sample.localTime)
    }
    for (const event of recording.events) {
      if (!['connected', 'resume', 'buffer-recovered', 'command:seek', 'command:play', 'command:restart'].includes(event.event)) continue
      const boundary = recording.events.find(e => e.at > event.at && /^(command:|away$|disconnected$|resume$|connected$|buffering$|ended$|error:)/.test(e.event))?.at ?? Infinity
      let recoveredAt: number | undefined
      for (let i = 0; i + 2 < recording.samples.length; i++) {
        const group = recording.samples.slice(i, i + 3)
        if (group[0]!.localTime < event.at || group[2]!.localTime >= boundary) continue
        if (group.every(s => s.status === 'following' && s.connected && Math.abs(s.errorMs) <= 300
          && s.playbackId === group[0]!.playbackId && s.revision === group[0]!.revision)) { recoveredAt = group[2]!.localTime; break }
      }
      recoveries.push({ trigger: event.event, durationMs: recoveredAt === undefined ? null : recoveredAt - event.at })
    }
    const span = recording.samples.length > 1 ? recording.samples.at(-1)!.localTime - recording.samples[0]!.localTime : 0
    return { sampleCount: recording.samples.length, spanMs: span, states, durationsMs: durations, hardSeeks: recording.samples.at(-1)?.seeks ?? 0, recoveries }
  }
  return {
    pairedSteadySamples: differences.length,
    pairedCoverage: differences.length / Math.max(1, Math.min(a.samples.length, b.samples.length)),
    p50Ms: percentile(differences, 0.5), p95Ms: percentile(differences, 0.95),
    maxMs: differences.at(-1) ?? null,
    clockUncertaintyP95Ms: percentile(uncertainties, 0.95),
    participants: [summarize(a), summarize(b)],
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  if (!process.argv[2] || !process.argv[3]) throw new Error('Usage: node experiments/listen-together/analyze.ts host.json member.json')
  const [a, b] = process.argv.slice(2, 4).map(file => JSON.parse(readFileSync(file!, 'utf8')) as Recording)
  console.log(JSON.stringify(compareRecordings(a!, b!), null, 2))
}
