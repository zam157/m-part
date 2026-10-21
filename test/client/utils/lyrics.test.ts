import { describe, expect, it } from 'vitest'
import { activeLyricIndex, mergeLyrics, parseLrc } from '~/utils/lyrics'

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
