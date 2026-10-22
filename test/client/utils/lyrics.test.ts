import { describe, expect, it } from 'vitest'
import { activeLyricIndex, lyricWordProgress, mergeLyrics, parseLrc, parseYrc } from '~/utils/lyrics'

describe('LRC', () => {
  it('展开重复标签、处理小数与正负 offset，并排序合并同时刻的行', () => {
    expect(parseLrc('[ar:artist]\n[offset:500]\n[00:20.123][00:01.2]重复\n[00:01.20]合唱\n[00:22]\n')).toEqual([
      { time: 0.7, text: '重复\n合唱' }, { time: 19.623, text: '重复' }, { time: 21.5, text: '' },
    ])
    expect(parseLrc('[offset:-250]\n[00:01.000]延后')[0]?.time).toBe(1.25)
  })
  it('忽略元信息，保留无时间轴文本；有时间轴时不混入游离文本', () => {
    expect(parseLrc('[ti:title]\n第一行\r\n第二行')).toEqual([{ time: null, text: '第一行' }, { time: null, text: '第二行' }])
    expect(parseLrc('游离文本\n[00:01]歌词')).toEqual([{ time: 1, text: '歌词' }])
    expect(parseLrc('')).toEqual([])
  })
  it('翻译与音译按时间轴匹配，不依赖行数或顺序', () => {
    expect(mergeLyrics({ original: '[00:01]Hello\n[00:02]World', translated: '[00:02]世界', romanized: '[00:01]he-llo' })).toEqual([
      { time: 1, text: 'Hello', translation: undefined, romanization: 'he-llo' },
      { time: 2, text: 'World', translation: '世界', romanization: undefined },
    ])
  })
  it('定位前奏、精确时间、快进及回退；纯文本无活动行', () => {
    const lines = parseLrc('[00:05]a\n[00:10]b\n[00:20]c')
    expect([0, 5, 19, 99, 6].map(time => activeLyricIndex(lines, time))).toEqual([-1, 0, 1, 2, 0])
    expect(activeLyricIndex(parseLrc('text'), 10)).toBe(-1)
    expect(activeLyricIndex([], 10)).toBe(-1)
    expect(activeLyricIndex(lines, Number.NaN)).toBe(-1)
  })
})

describe('逐字歌词', () => {
  it('YRC 使用绝对毫秒并保留空格、标点、字间停顿，跳过 JSON 元数据', () => {
    const lines = parseYrc('{"t":0,"c":[{"tx":"作词：作者"}]}\n[5000,3000](5000,500,0)你(6000,1000,0)好！\n[9000,1000](9000,1000,0)Hello world')
    expect(lines).toEqual([
      { time: 5, text: '你好！', words: [{ time: 5, duration: 0.5, text: '你' }, { time: 6, duration: 1, text: '好！' }] },
      { time: 9, text: 'Hello world', words: [{ time: 9, duration: 1, text: 'Hello world' }] },
    ])
  })

  it('offset 同时移动行与字，超过音频起点的部分裁剪到零', () => {
    expect(parseYrc('[offset:500]\n[200,1500](200,500,0)你(1000,500,0)好')[0]).toEqual({
      time: 0, text: '你好', words: [{ time: 0, duration: 0.2, text: '你' }, { time: 0.5, duration: 0.5, text: '好' }],
    })
  })

  it('优先逐字歌词及其配套翻译，无逐字数据或时间轴损坏时保留原有逐行时间轴', () => {
    const original = '[00:05]你好\n[00:10]世界'
    const translated = '[00:05]Hello'
    expect(mergeLyrics({ original, translated, wordByWord: { original: '[4500,2000](4500,1000,0)你(5500,1000,0)好', translated: '[00:04.5]Hi' } })[0]).toMatchObject({ time: 4.5, text: '你好', translation: 'Hi', words: expect.any(Array) })
    for (const value of ['', '歌词尚未提供', '[5000,2000](6000,500,0)你(5000,500,0)好']) {
      expect(mergeLyrics({ original, translated, wordByWord: { original: value } })).toEqual(mergeLyrics({ original, translated }))
    }
  })

  it('混合数据中没有有效逐字时间的行只使用逐行高亮', () => {
    const lines = mergeLyrics({ original: '', wordByWord: { original: '[5000,1000](5000,500,0)你(5500,500,0)好\n[7000,1000]只有逐行' } })
    expect(lines[0]?.words).toHaveLength(2)
    expect(lines[1]).toMatchObject({ time: 7, text: '只有逐行' })
    expect(lines[1]?.words).toBeUndefined()
  })

  it('增强 LRC 解析字内时间和结束标记，重复行同步平移字时间', () => {
    const lines = parseLrc('[offset:500]\n[00:05][00:15]<00:05>Hello <00:06>world<00:07>')
    expect(lines[0]).toMatchObject({ time: 4.5, text: 'Hello world', words: [{ time: 4.5, duration: 1, text: 'Hello ' }, { time: 5.5, duration: 1, text: 'world' }] })
    expect(lines[1]?.words?.[0]?.time).toBe(14.5)
    expect(parseLrc('[00:05]Hello <00:06>world<00:07>')[0]?.words).toEqual([{ time: 5, duration: 1, text: 'Hello ' }, { time: 6, duration: 1, text: 'world' }])
  })

  it('相同起点的合唱保留各自字时间及换行', () => {
    const lines = parseYrc('[5000,1000](5000,1000,0)Hello\n[5000,1000](5000,1000,0)你好')
    expect(lines).toHaveLength(1)
    expect(lines[0]?.text).toBe('Hello\n你好')
    expect(lines[0]?.words?.map(word => word.text).join('')).toBe('Hello\n你好')
  })

  it('字内高亮按绝对时间计算，支持前奏、停顿、快进、回退及零时长', () => {
    const word = { time: 5, duration: 2, text: '你' }
    expect([0, 5, 6, 7, 99, 5.5].map(time => lyricWordProgress(word, time))).toEqual([0, 0, 0.5, 1, 1, 0.25])
    expect(lyricWordProgress(word, Number.NaN)).toBe(0)
    expect(lyricWordProgress({ ...word, duration: 0 }, 5)).toBe(1)
  })
})
