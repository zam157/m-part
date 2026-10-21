import type { MusicInfo } from '#shared/types/music-info'
import { createRoot, createSignal, flush } from 'solid-js'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
const { getLyrics } = vi.hoisted(() => ({ getLyrics: vi.fn() }))
vi.mock('#shared/utils/providers', () => ({ providers: { netease: { getLyrics }, bili: {} } }))
const { createLyrics } = await import('~/composables/lyrics')
let cleanup: (() => void) | undefined
let serial = 0
const music = (id: string): MusicInfo => ({ provider: 'netease', id, title: id, duration: 30, coverUrl: '' })
function mount() {
  const state = createRoot((dispose) => {
    cleanup = dispose
    const [song, setSong] = createSignal<MusicInfo | null>(music(`lyrics-${++serial}`))
    const [enabled, setEnabled] = createSignal(true)
    return { song, setSong, setEnabled, lyrics: createLyrics(song, enabled) }
  })
  flush()
  return state
}
beforeEach(() => getLyrics.mockReset())
afterEach(() => cleanup?.())

describe('歌词请求状态', () => {
  it('打开才加载，缓存复用，进度无关的元数据更新不会重新读取', async () => {
    getLyrics.mockResolvedValue({ original: '[00:01]one' })
    const state = mount()
    await vi.waitFor(() => expect(state.lyrics.loading()).toBe(false))
    flush()
    expect(state.lyrics.lines()[0]?.text).toBe('one')
    state.setEnabled(false)
    flush()
    state.setSong({ ...state.song()!, title: '新的标题' })
    state.setEnabled(true)
    flush()
    expect(state.lyrics.lines()[0]?.text).toBe('one')
    expect(getLyrics).toHaveBeenCalledTimes(1)
  })
  it('快速切歌取消旧任务，迟到响应不会覆盖或污染缓存', async () => {
    let resolveOld!: (value: { original: string }) => void
    getLyrics.mockImplementationOnce(() => new Promise(resolve => { resolveOld = resolve }))
    getLyrics.mockResolvedValueOnce({ original: '[00:02]new' })
    const state = mount()
    const signal = getLyrics.mock.calls[0]![1].signal as AbortSignal
    state.setSong(music('new-track'))
    flush()
    expect(signal.aborted).toBe(true)
    await vi.waitFor(() => expect(state.lyrics.lines()[0]?.text).toBe('new'))
    resolveOld({ original: '[00:01]old' })
    await Promise.resolve()
    flush()
    expect(state.lyrics.lines()[0]?.text).toBe('new')
    expect(state.lyrics.error()).toBeNull()
  })
  it('失败可重试，收起后取消请求且不展示取消错误', async () => {
    getLyrics.mockRejectedValueOnce(new Error('网络失败')).mockResolvedValueOnce({ original: '' })
    const state = mount()
    await vi.waitFor(() => expect(state.lyrics.error()).toBe('网络失败'))
    state.lyrics.retry()
    flush()
    await vi.waitFor(() => expect(state.lyrics.loading()).toBe(false))
    expect(state.lyrics.error()).toBeNull()
    getLyrics.mockImplementationOnce(() => new Promise(() => {}))
    state.setSong(music('pending-track'))
    flush()
    const signal = getLyrics.mock.calls.at(-1)![1].signal as AbortSignal
    state.setEnabled(false)
    flush()
    expect(signal.aborted).toBe(true)
    expect(state.lyrics.error()).toBeNull()
  })
  it('音源不支持时不请求，曲目自带歌词仍可展示', async () => {
    getLyrics.mockResolvedValue({ original: '' })
    const state = mount()
    state.setSong({ ...music('bili-track'), provider: 'bili', lrc: '[00:03]内嵌歌词' })
    flush()
    expect(state.lyrics.lines()[0]?.text).toBe('内嵌歌词')
    state.setSong({ ...music('no-lyrics'), provider: 'bili' })
    flush()
    expect(state.lyrics.lines()).toEqual([])
    expect(state.lyrics.loading()).toBe(false)
    expect(state.lyrics.error()).toBeNull()
  })
})
