export interface QueueTrackIdentity { provider: string, id: string }
export function trackKey(track: QueueTrackIdentity) { return `${track.provider}:${track.id}` }

/** Identity, never object reference or display title, determines queue membership. */
export function uniqueTracks<T extends QueueTrackIdentity>(tracks: readonly T[], preferred?: T): T[] {
  const seen = new Set<string>()
  const preferredKey = preferred && trackKey(preferred)
  return tracks.flatMap(track => {
    const key = trackKey(track)
    if (seen.has(key)) return []
    seen.add(key)
    return [key === preferredKey ? preferred! : track]
  })
}

/** Existing entries retain their metadata and room IDs; the current entry is never moved into itself. */
export function insertQueueTracks<T extends QueueTrackIdentity>(original: readonly T[], incoming: readonly T[], currentIndex: number | null, placement: 'next' | 'end') {
  const current = currentIndex === null ? undefined : original[currentIndex]
  const currentKey = current && trackKey(current)
  let queue = uniqueTracks(original, current)
  const existing = new Map(queue.map(track => [trackKey(track), track]))
  const selected = uniqueTracks(incoming).map(track => existing.get(trackKey(track)) ?? track)
  const selectedKeys = new Set(selected.map(trackKey))
  if (placement === 'next' && current) {
    queue = queue.filter(track => !selectedKeys.has(trackKey(track)) || trackKey(track) === currentKey)
    queue.splice(queue.findIndex(track => trackKey(track) === currentKey) + 1, 0, ...selected.filter(track => trackKey(track) !== currentKey))
  }
  else queue.push(...selected.filter(track => !existing.has(trackKey(track))))
  return { queue, selected, currentIndex: current ? queue.findIndex(track => trackKey(track) === currentKey) : null }
}

/** Preserve the relative shuffle order as queue entries move or duplicates disappear. */
export function remapQueueOrder<T extends QueueTrackIdentity>(original: readonly T[], next: readonly T[], order: readonly number[] | null) {
  const indices = new Map(next.map((track, index) => [trackKey(track), index]))
  const seen = new Set<number>()
  const result: number[] = []
  for (const index of order ?? original.map((_, index) => index)) {
    const track = original[index]
    const nextIndex = track && indices.get(trackKey(track))
    if (nextIndex !== undefined && !seen.has(nextIndex)) { seen.add(nextIndex); result.push(nextIndex) }
  }
  for (let index = 0; index < next.length; index++) if (!seen.has(index)) result.push(index)
  return result
}
