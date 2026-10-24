import { createComponent, render } from '@solidjs/web'
import { flush } from 'solid-js'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
const { parts } = vi.hoisted(() => ({ parts: vi.fn() }))
vi.mock('@m-part/music/providers', () => ({ providers: { bili: { getTrackParts: parts } } }))
import BiliPartPicker from '~/components/BiliPartPicker/BiliPartPicker'
import { biliParts, cancelBiliParts, chooseBiliParts } from '~/composables/bili-parts'
const video = { provider: 'bili' as const, id: 'BV1234567890', title: '视频', duration: 300, coverUrl: '' }
const tracks = [123, 456].map((cid, index) => ({ ...video, id: `${video.id}:${cid}`, title: `P${index + 1} 分 P`, duration: 120 + index * 60 }))
let dispose: () => void
let container: HTMLDivElement
const tick = async () => { await Promise.resolve(); await Promise.resolve(); flush() }
beforeEach(() => {
  parts.mockReset().mockResolvedValue(tracks)
  Object.defineProperty(HTMLDialogElement.prototype, 'showModal', { configurable: true, value() { this.setAttribute('open', '') } })
  Object.defineProperty(HTMLDialogElement.prototype, 'close', { configurable: true, value() { this.removeAttribute('open') } })
  container = document.createElement('div'); document.body.append(container)
  dispose = render(() => createComponent(BiliPartPicker, {}), container); flush()
})
afterEach(() => { cancelBiliParts(); flush(); dispose(); container.remove(); vi.restoreAllMocks() })
const button = (text: string) => [...container.querySelectorAll('button')].find(button => button.textContent === text)!
describe('Bili part selection', () => {
  it('waits for an explicit choice, supports filtering and appends multiple parts in source order', async () => {
    const pending = chooseBiliParts(video)
    await tick()
    expect(container.querySelector('dialog')?.open).toBe(true)
    expect(biliParts()?.tracks).toHaveLength(2)
    button('全选').click(); flush()
    const search = container.querySelector<HTMLInputElement>('[aria-label="搜索分 P"]')!
    search.value = 'P2'; search.dispatchEvent(new Event('input', { bubbles: true })); flush()
    expect(container.querySelectorAll('input[type=checkbox]')).toHaveLength(1)
    button('加入队列').click(); flush()
    expect(await pending).toEqual({ tracks, action: 'append' })
    expect(container.querySelector('dialog')?.open).toBe(false)
  })
  it('plays the chosen P2 directly, not P1', async () => {
    const pending = chooseBiliParts(video)
    await tick()
    container.querySelector<HTMLButtonElement>('[aria-label="播放 P2 分 P"]')!.click(); flush()
    expect(await pending).toEqual({ tracks: [tracks[1]], action: 'play' })
  })
  it('keeps errors retryable and cancels without choosing a default part', async () => {
    parts.mockRejectedValueOnce(new Error('读取失败'))
    const pending = chooseBiliParts(video)
    await tick()
    expect(container.textContent).toContain('读取失败')
    button('重新加载分 P').click(); await tick()
    expect(biliParts()?.tracks).toHaveLength(2)
    container.querySelector('dialog')!.dispatchEvent(new Event('cancel')); flush()
    expect(await pending).toBeNull()
  })
  it('does not let a late response replace a newer selection request', async () => {
    let resolve!: (value: typeof tracks) => void
    parts.mockImplementationOnce(() => new Promise(r => { resolve = r }))
    const previous = chooseBiliParts(video)
    const current = chooseBiliParts({ ...video, title: '新视频' })
    await tick(); resolve(tracks); await tick()
    expect(await previous).toBeNull()
    expect(biliParts()?.music.title).toBe('新视频')
    cancelBiliParts(); expect(await current).toBeNull()
  })
  it('directly resolves a single-page video without waiting for a selection', async () => {
    parts.mockResolvedValue([tracks[0]])
    expect(await chooseBiliParts(video)).toEqual({ tracks: [tracks[0]], action: 'play' })
  })
})
