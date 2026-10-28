import { createComponent, render } from '@solidjs/web'
import { flush } from 'solid-js'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
const { parts, otherParts } = vi.hoisted(() => ({ parts: vi.fn(), otherParts: vi.fn() }))
vi.mock('@m-part/music/providers', () => ({ providers: { bili: { getTrackParts: parts, trackPartsLabel: '分 P' }, qq: { getTrackParts: otherParts } } }))
import TrackPartPicker from '~/components/TrackPartPicker/TrackPartPicker'
import { trackParts, cancelTrackParts, chooseTrackParts } from '~/composables/track-parts'
import { providers } from '@m-part/music/providers'
const video = { provider: 'bili' as const, id: 'BV1234567890', title: '视频', duration: 300, coverUrl: '' }
const tracks = [123, 456].map((cid, index) => ({ ...video, id: `${video.id}:${cid}`, title: `P${index + 1} 分 P`, duration: 120 + index * 60 }))
let dispose: () => void
let container: HTMLDivElement
const tick = async () => { await Promise.resolve(); await Promise.resolve(); flush() }
beforeEach(() => {
  parts.mockReset().mockResolvedValue(tracks)
  otherParts.mockReset()
  delete providers.qq.trackPartsLabel
  Object.defineProperty(HTMLDialogElement.prototype, 'showModal', { configurable: true, value() { this.setAttribute('open', '') } })
  Object.defineProperty(HTMLDialogElement.prototype, 'close', { configurable: true, value() { this.removeAttribute('open') } })
  container = document.createElement('div'); document.body.append(container)
  dispose = render(() => createComponent(TrackPartPicker, {}), container); flush()
})
afterEach(() => { cancelTrackParts(); flush(); dispose(); container.remove(); vi.restoreAllMocks() })
const button = (text: string) => [...container.querySelectorAll('button')].find(button => button.textContent === text)!
describe('provider track part selection', () => {
  it.each([undefined, '章节'])('uses another provider and its label %s without Bili IDs', async (label) => {
    providers.qq.trackPartsLabel = label
    const music = { ...video, provider: 'qq' as const, id: 'collection/root' }
    const chapters = tracks.map((track, i) => ({ ...track, provider: 'qq' as const, id: `chapter/${i}`, title: `章节 ${i + 1}` }))
    otherParts.mockResolvedValue(chapters)
    const pending = chooseTrackParts(music, 'next')
    await tick()
    expect(container.querySelector('h2')?.textContent).toBe(`选择${label ?? '分段'}`)
    expect(otherParts).toHaveBeenCalledWith(music, { signal: expect.any(AbortSignal) })
    expect(parts).not.toHaveBeenCalled()
    button('全选').click(); flush()
    button('设为下一首').click(); flush()
    expect(await pending).toEqual({ tracks: chapters, action: 'next' })
  })
  it('does not open a selector for providers without the capability', async () => {
    expect(await chooseTrackParts({ ...video, provider: 'netease' })).toBeNull()
    flush()
    expect(container.querySelector('dialog')?.open).toBe(false)
    expect(parts).not.toHaveBeenCalled()
  })
  it('shows an error instead of leaving an empty selector when a provider returns no tracks', async () => {
    otherParts.mockResolvedValue([])
    const pending = chooseTrackParts({ ...video, provider: 'qq' })
    await tick()
    expect(container.querySelector('[role="alert"]')?.textContent).toContain('没有可播放的分段')
    cancelTrackParts(); expect(await pending).toBeNull()
  })
  it('waits for an explicit choice, supports filtering and appends multiple parts in source order', async () => {
    const pending = chooseTrackParts(video)
    await tick()
    expect(container.querySelector('dialog')?.open).toBe(true)
    expect(trackParts()?.tracks).toHaveLength(2)
    button('全选').click(); flush()
    const search = container.querySelector<HTMLInputElement>('[aria-label="搜索分 P"]')!
    search.value = 'P2'; search.dispatchEvent(new Event('input', { bubbles: true })); flush()
    expect(container.querySelectorAll('input[type=checkbox]')).toHaveLength(1)
    button('加入队列').click(); flush()
    expect(await pending).toEqual({ tracks, action: 'append' })
    expect(container.querySelector('dialog')?.open).toBe(false)
  })
  it('plays the chosen P2 directly, not P1', async () => {
    const pending = chooseTrackParts(video)
    await tick()
    container.querySelector<HTMLButtonElement>('[aria-label="播放 P2 分 P"]')!.click(); flush()
    expect(await pending).toEqual({ tracks: [tracks[1]], action: 'play' })
  })
  it('keeps errors retryable and cancels without choosing a default part', async () => {
    parts.mockRejectedValueOnce(new Error('读取失败'))
    const pending = chooseTrackParts(video)
    await tick()
    expect(container.textContent).toContain('读取失败')
    button('重新加载分 P').click(); await tick()
    expect(trackParts()?.tracks).toHaveLength(2)
    container.querySelector('dialog')!.dispatchEvent(new Event('cancel')); flush()
    expect(await pending).toBeNull()
  })
  it('does not let a late response replace a newer selection request', async () => {
    let resolve!: (value: typeof tracks) => void
    parts.mockImplementationOnce(() => new Promise(r => { resolve = r }))
    const previous = chooseTrackParts(video)
    const current = chooseTrackParts({ ...video, title: '新视频' })
    await tick(); resolve(tracks); await tick()
    expect(await previous).toBeNull()
    expect(trackParts()?.music.title).toBe('新视频')
    cancelTrackParts(); expect(await current).toBeNull()
  })
  it('directly resolves a single-page video without waiting for a selection', async () => {
    let resolve!: (value: typeof tracks) => void
    parts.mockImplementationOnce(() => new Promise(r => { resolve = r }))
    const show = vi.spyOn(HTMLDialogElement.prototype, 'showModal')
    const pending = chooseTrackParts(video)
    await tick()
    expect(trackParts()?.loading).toBe(true)
    expect(show).not.toHaveBeenCalled()
    resolve([tracks[0]!]); await tick()
    expect(await pending).toEqual({ tracks: [tracks[0]], action: 'play' })
    expect(show).not.toHaveBeenCalled()
    expect(container.querySelector('dialog')?.open).toBe(false)
  })
  it('opens only after a delayed multi-part response arrives', async () => {
    let resolve!: (value: typeof tracks) => void
    parts.mockImplementationOnce(() => new Promise(r => { resolve = r }))
    const pending = chooseTrackParts(video)
    await tick()
    expect(container.querySelector('dialog')?.open).toBe(false)
    resolve(tracks); await tick()
    expect(container.querySelector('dialog')?.open).toBe(true)
    cancelTrackParts(); expect(await pending).toBeNull()
  })
  it('keeps a failed selector open while retrying a delayed request', async () => {
    parts.mockRejectedValueOnce(new Error('读取失败'))
    const pending = chooseTrackParts(video)
    await tick()
    expect(container.querySelector('dialog')?.open).toBe(true)
    let resolve!: (value: typeof tracks) => void
    parts.mockImplementationOnce(() => new Promise(r => { resolve = r }))
    const close = vi.spyOn(HTMLDialogElement.prototype, 'close')
    button('重新加载分 P').click(); await tick()
    expect(trackParts()?.loading).toBe(true)
    expect(container.querySelector('dialog')?.open).toBe(true)
    expect(close).not.toHaveBeenCalled()
    resolve(tracks); await tick()
    expect(trackParts()?.tracks).toHaveLength(2)
    cancelTrackParts(); expect(await pending).toBeNull()
  })
})
