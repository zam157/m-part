import type { LyricsInfo } from '#shared/types/provider'

export interface LyricLine {
  time: number | null
  text: string
  translation?: string
  romanization?: string
}

/** Simple LRC：多时间标签、毫秒、全局 offset，以及没有时间轴的纯文本。 */
export function parseLrc(source = ''): LyricLine[] {
  const offset = Number(source.match(/\[offset:([+-]?\d+)\]/i)?.[1] ?? 0) / 1000
  const timed: LyricLine[] = []
  const plain: LyricLine[] = []
  for (const raw of source.replace(/^\uFEFF/, '').split(/\r?\n/)) {
    const tags = [...raw.matchAll(/\[(\d+):([0-5]?\d)(?:[.:](\d{1,3}))?\]/g)]
    const text = raw.replace(/\[[^\]]*\]/g, '').replace(/<\d+:\d+(?:\.\d+)?>/g, '').trim()
    for (const tag of tags) {
      const time = Number(tag[1]) * 60 + Number(tag[2]) + Number(`0.${tag[3] ?? 0}`) - offset
      timed.push({ time: Math.max(0, time), text })
    }
    if (!tags.length && text) plain.push({ time: null, text })
  }
  if (!timed.length) return plain
  // 同一时刻的多行（例如合唱）合并，保证高亮和点击定位一致。
  const merged = new Map<number, LyricLine>()
  for (const line of timed.sort((a, b) => a.time! - b.time!)) {
    const previous = merged.get(line.time!)
    if (previous) previous.text = [previous.text, line.text].filter(Boolean).join('\n')
    else merged.set(line.time!, { ...line })
  }
  return [...merged.values()]
}

export function mergeLyrics(lyrics: LyricsInfo): LyricLine[] {
  const lines = parseLrc(lyrics.original)
  const translated = new Map(parseLrc(lyrics.translated).filter(line => line.time !== null).map(line => [line.time, line.text]))
  const romanized = new Map(parseLrc(lyrics.romanized).filter(line => line.time !== null).map(line => [line.time, line.text]))
  return lines.map(line => ({ ...line, translation: translated.get(line.time), romanization: romanized.get(line.time) }))
}

/** 只随播放时间计算行号；跳进、回退与前奏都不需要依次扫描。 */
export function activeLyricIndex(lines: LyricLine[], time: number): number {
  if (!Number.isFinite(time) || !lines.length || lines[0]!.time === null) return -1
  let low = 0
  let high = lines.length - 1
  while (low <= high) {
    const middle = (low + high) >>> 1
    if (lines[middle]!.time! <= time) low = middle + 1
    else high = middle - 1
  }
  return high
}
