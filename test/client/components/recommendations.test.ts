import { createComponent, render } from '@solidjs/web'
import { flush } from 'solid-js'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { getRecommendations, addToPlayQueue } = vi.hoisted(() => ({ getRecommendations: vi.fn(), addToPlayQueue: vi.fn() }))
vi.mock('#shared/utils/providers/index', () => ({ providers: { bili: { getRecommendations } } }))
vi.mock('~/composables/player', () => ({ addToPlayQueue, addNextToPlayQueue: vi.fn(), currentSong: () => null }))

const song = { provider: 'bili' as const, id: '1', title: '原来的歌曲', duration: 60, coverUrl: '' }
let home: typeof import('~/composables/recommendations')
let component: typeof import('~/components/Recommendations/Recommendations')
let container: HTMLDivElement
let dispose: (() => void) | undefined

beforeEach(async () => {
  vi.resetModules()
  getRecommendations.mockReset().mockResolvedValue([song])
  addToPlayQueue.mockReset()
  home = await import('~/composables/recommendations')
  component = await import('~/components/Recommendations/Recommendations')
  container = document.createElement('div')
  document.body.append(container)
})

afterEach(() => {
  dispose?.()
  container.remove()
})

async function mount() {
  dispose = render(() => createComponent(component.default, { source: 'bili', title: '推荐', description: '推荐歌曲' }), container)
  flush()
  await home.loadRecommendations('bili')
  flush()
}

describe('首页推荐刷新展示', () => {
  it('刷新期间保留原歌曲节点与播放操作，成功后替换结果', async () => {
    await mount()
    const original = container.querySelector<HTMLButtonElement>('[aria-label="播放 原来的歌曲"]')!
    let finish!: (items: typeof song[]) => void
    getRecommendations.mockReturnValueOnce(new Promise(resolve => { finish = resolve }))
    const request = home.loadRecommendations('bili', true)
    await Promise.resolve()
    flush()
    expect(container.querySelector('[aria-label="播放 原来的歌曲"]')).toBe(original)
    expect(container.querySelector('[role="status"]')).toBeNull()
    expect(container.querySelector('section')?.getAttribute('aria-busy')).toBe('true')
    expect(container.querySelector<HTMLButtonElement>('[aria-label="刷新推荐"]')?.disabled).toBe(true)
    original.click()
    expect(addToPlayQueue).toHaveBeenCalledWith(song)
    finish([{ ...song, id: '2', title: '新的歌曲' }])
    await request
    flush()
    expect(container.querySelector('[aria-label="播放 原来的歌曲"]')).toBeNull()
    expect(container.querySelector('[aria-label="播放 新的歌曲"]')).not.toBeNull()
  })

  it('刷新失败显示提示并保留上次歌曲，初次失败仍显示错误态', async () => {
    getRecommendations.mockRejectedValueOnce(new Error('网络异常'))
    await mount()
    expect(container.textContent).toContain('加载失败')
    await home.loadRecommendations('bili', true)
    flush()
    const original = container.querySelector('[aria-label="播放 原来的歌曲"]')
    getRecommendations.mockRejectedValueOnce(new Error('断网'))
    await home.loadRecommendations('bili', true)
    flush()
    expect(container.querySelector('[aria-label="播放 原来的歌曲"]')).toBe(original)
    expect(container.querySelector('[role="alert"]')?.textContent).toContain('断网')
    expect(container.querySelector<HTMLButtonElement>('[aria-label="刷新推荐"]')?.disabled).toBe(false)
  })

  it('已加载的空结果在刷新时保留空状态，不切回骨架', async () => {
    getRecommendations.mockResolvedValueOnce([])
    await mount()
    let finish!: (items: typeof song[]) => void
    getRecommendations.mockReturnValueOnce(new Promise(resolve => { finish = resolve }))
    const request = home.loadRecommendations('bili', true)
    await Promise.resolve()
    flush()
    expect(container.textContent).toContain('暂时没有推荐内容')
    expect(container.querySelector('[role="status"]')).toBeNull()
    finish([])
    await request
    flush()
  })
})
