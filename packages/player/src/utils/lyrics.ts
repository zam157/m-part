import type { LyricsInfo } from '@m-part/music/types/provider'

export interface LyricWord {
  time: number
  duration: number
  text: string
}

export interface LyricLine {
  time: number | null
  text: string
  translation?: string
  romanization?: string
  words?: LyricWord[]
}

const offsetSeconds = (source: string) => Number(source.match(/\[offset:([+-]?\d+)\]/i)?.[1] ?? 0) / 1000
const tagTime = (tag: RegExpMatchArray) => Number(tag[1]) * 60 + Number(tag[2]) + Number(`0.${tag[3] ?? 0}`)

function mergeTimedLines(lines: LyricLine[]): LyricLine[] {
  const merged = new Map<number, LyricLine>()
  for (const line of lines.sort((a, b) => a.time! - b.time!)) {
    const previous = merged.get(line.time!)
    if (previous) {
      if (previous.words && line.words)
        previous.words.push({ time: line.time!, duration: 0, text: '\n' }, ...line.words)
      else delete previous.words
      previous.text = [previous.text, line.text].filter(Boolean).join('\n')
    }
    else merged.set(line.time!, { ...line })
  }
  return [...merged.values()]
}

/** 增强 LRC 的角括号时间标记；最后一个字无结束标签时在其起点点亮。 */
function enhancedWords(content: string, lineTime: number, shift: number): LyricWord[] | undefined {
  const tags = [...content.matchAll(/<(\d+):([0-5]?\d)(?:[.:](\d{1,3}))?>/g)]
  if (!tags.length) return
  const words: LyricWord[] = []
  const prefix = content.slice(0, tags[0]!.index)
  if (prefix.trim()) words.push({ time: Math.max(0, lineTime), duration: Math.max(0, tagTime(tags[0]!) + shift) - Math.max(0, lineTime), text: prefix })
  for (let i = 0; i < tags.length; i++) {
    const tag = tags[i]!
    const next = tags[i + 1]
    const text = content.slice(tag.index + tag[0].length, next?.index)
    const start = tagTime(tag) + shift
    const end = next ? tagTime(next) + shift : start
    if (!Number.isFinite(start) || !Number.isFinite(end) || start < lineTime || end < start) return
    if (text) words.push({ time: Math.max(0, start), duration: Math.max(0, end) - Math.max(0, start), text })
  }
  return words.length ? words : undefined
}

/** Simple / 增强 LRC：多时间标签、毫秒、offset，以及没有时间轴的纯文本。 */
export function parseLrc(source = ''): LyricLine[] {
  const offset = offsetSeconds(source)
  const timed: LyricLine[] = []
  const plain: LyricLine[] = []
  for (const raw of source.replace(/^\uFEFF/, '').split(/\r?\n/)) {
    const tags = [...raw.matchAll(/\[(\d+):([0-5]?\d)(?:[.:](\d{1,3}))?\]/g)]
    const content = raw.replace(/\[[^\]]*\]/g, '')
    const text = content.replace(/<\d+:\d+(?:[.:]\d+)?>/g, '').trim()
    for (const tag of tags) {
      const time = tagTime(tag) - offset
      const words = enhancedWords(content, time, tagTime(tag) - tagTime(tags[0]!) - offset)
      timed.push({ time: Math.max(0, time), text, ...(words ? { words } : {}) })
    }
    if (!tags.length && text) plain.push({ time: null, text })
  }
  if (!timed.length) return plain
  return mergeTimedLines(timed)
}

/** 网易云 YRC：行、字的起点均为绝对毫秒；忽略 JSON 元数据。 */
export function parseYrc(source = ''): LyricLine[] {
  const offset = offsetSeconds(source) * 1000
  if (!Number.isFinite(offset)) return []
  const lines: LyricLine[] = []
  for (const raw of source.replace(/^\uFEFF/, '').split(/\r?\n/)) {
    const line = raw.match(/^\[(\d+),(\d+)\](.*)$/)
    if (!line) continue
    const start = Number(line[1])
    const end = start + Number(line[2])
    if (!Number.isFinite(end) || end < start) continue
    const content = line[3]!
    const tags = [...content.matchAll(/\((\d+),(\d+),\d+\)/g)]
    const words: LyricWord[] = []
    let valid = !!tags.length && !content.slice(0, tags[0]?.index).trim()
    for (let i = 0; i < tags.length; i++) {
      const tag = tags[i]!
      const time = Number(tag[1])
      const duration = Number(tag[2])
      const text = content.slice(tag.index + tag[0].length, tags[i + 1]?.index)
      valid &&= Number.isFinite(time + duration) && time >= start && time + duration <= end + 1
        && (!i || time >= Number(tags[i - 1]![1]))
      if (text) words.push({ time: Math.max(0, time - offset) / 1000, duration: (Math.max(0, time + duration - offset) - Math.max(0, time - offset)) / 1000, text })
    }
    const text = content.replace(/\(\d+,\d+,\d+\)/g, '').trim()
    lines.push({ time: Math.max(0, start - offset) / 1000, text, ...(valid && words.length ? { words } : {}) })
  }
  return mergeTimedLines(lines)
}

export function mergeLyrics(lyrics: LyricsInfo): LyricLine[] {
  const wordSource = lyrics.wordByWord
  const yrc = parseYrc(wordSource?.original)
  const wordLines = yrc.length ? yrc : parseLrc(wordSource?.original)
  const hasWords = wordLines.some(line => line.words?.length)
  const lines = hasWords ? wordLines : parseLrc(lyrics.original)
  const translation = hasWords ? wordSource?.translated || lyrics.translated : lyrics.translated
  const romanization = hasWords ? wordSource?.romanized || lyrics.romanized : lyrics.romanized
  const translated = new Map(parseLrc(translation).filter(line => line.time !== null).map(line => [line.time, line.text]))
  const romanized = new Map(parseLrc(romanization).filter(line => line.time !== null).map(line => [line.time, line.text]))
  return lines.map(line => ({ ...line, translation: translated.get(line.time), romanization: romanized.get(line.time) }))
}

/** 直接由媒体时间求字内进度，暂停、跳转、变速和回退不会累积动画误差。 */
export function lyricWordProgress(word: LyricWord, time: number): number {
  if (!Number.isFinite(time) || time < word.time) return 0
  return word.duration > 0 ? Math.min(1, (time - word.time) / word.duration) : 1
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
