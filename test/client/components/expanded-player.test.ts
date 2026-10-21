import type { TooltipProps, TooltipTriggerProps } from '~/components/Tooltip/Tooltip'
import { createComponent, render } from '@solidjs/web'
import { flush } from 'solid-js'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import MusicPlayer from '~/components/MusicPlayer/MusicPlayer'
import { selectQuality } from '~/components/MusicPlayer/components/player-controls'

vi.mock('~/components/Tooltip/Tooltip', () => ({ default: (props: TooltipProps) => props.children({} as TooltipTriggerProps) }))
vi.mock('#shared/utils/constants', () => ({ TARGET_EXTENSION: true }))
vi.mock('#shared/utils/providers', () => ({ providers: { bili: { getSourceInfo: async () => ({ qualities: [{ name: '64K', url: 'https://cdn.example/low.mp3' }, { name: '192K', url: 'https://cdn.example/high.mp3' }] }) } } }))
const player = await import('~/composables/player')
const songs = ['a', 'b', 'c'].map(id => ({ provider: 'bili' as const, id, title: id, duration: 200, coverUrl: '', src: `https://cdn.example/${id}.mp3` }))
let dispose: (() => void) | undefined
let container: HTMLDivElement
let dialog: HTMLDialogElement
const descriptors = new Map<string, PropertyDescriptor | undefined>()

beforeEach(async () => {
  vi.spyOn(player.audio, 'pause').mockImplementation(() => {})
  vi.spyOn(player.audio, 'load').mockImplementation(() => {})
  vi.spyOn(player.audio, 'play').mockResolvedValue()
  player.setPlayMode('order')
  await player.setPlayQueue(songs)
  player.setCurrentTime(35)
  flush()
  const origins = new WeakMap<HTMLDialogElement, HTMLElement>()
  for (const key of ['showModal', 'close']) descriptors.set(key, Object.getOwnPropertyDescriptor(HTMLDialogElement.prototype, key))
  Object.defineProperties(HTMLDialogElement.prototype, {
    showModal: { configurable: true, value(this: HTMLDialogElement) { origins.set(this, document.activeElement as HTMLElement); this.open = true; this.querySelector<HTMLButtonElement>('[autofocus]')?.focus() } },
    close: { configurable: true, value(this: HTMLDialogElement) { this.open = false; origins.get(this)?.focus(); this.dispatchEvent(new Event('close')) } },
  })
  descriptors.set('scrollIntoView', Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'scrollIntoView'))
  Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', { configurable: true, value: vi.fn() })
  for (const key of ['showPopover', 'hidePopover']) descriptors.set(key, Object.getOwnPropertyDescriptor(HTMLElement.prototype, key))
  Object.defineProperties(HTMLElement.prototype, {
    showPopover: { configurable: true, value(this: HTMLElement) { this.setAttribute('data-test-open', 'true') } },
    hidePopover: { configurable: true, value(this: HTMLElement) { this.removeAttribute('data-test-open') } },
  })
  const matches = HTMLElement.prototype.matches
  vi.spyOn(HTMLElement.prototype, 'matches').mockImplementation(function (this: HTMLElement, selector) {
    return selector === ':popover-open' ? this.hasAttribute('data-test-open') : matches.call(this, selector)
  })
  container = document.createElement('div')
  document.body.append(container)
})

afterEach(() => {
  dispose?.()
  container.remove()
  for (const [key, descriptor] of descriptors) {
    const target = ['scrollIntoView', 'showPopover', 'hidePopover'].includes(key) ? HTMLElement.prototype : HTMLDialogElement.prototype
    if (descriptor) Object.defineProperty(target, key, descriptor)
    else Reflect.deleteProperty(target, key)
  }
  descriptors.clear()
  vi.restoreAllMocks()
})
function mount() {
  dispose = render(() => createComponent(MusicPlayer, {}), container)
  flush()
  dialog = document.querySelector('#expanded-player')!
}
function click(label: string, root: ParentNode = dialog) {
  const button = root.querySelector<HTMLButtonElement>(`button[aria-label="${label}"]`)!
  button.click()
  flush()
  return button
}
function open() {
  const trigger = container.querySelector<HTMLButtonElement>('[aria-label="展开播放器"]')!
  trigger.focus()
  trigger.click()
  flush()
  return trigger
}

describe('展开播放器', () => {
  it('展开和收起保持同一播放会话，取消请求返回来源焦点', () => {
    mount()
    vi.mocked(player.audio.load).mockClear()
    vi.mocked(player.audio.play).mockClear()
    vi.mocked(player.audio.pause).mockClear()
    const trigger = open()
    expect(dialog.open).toBe(true)
    expect(dialog.querySelector('h1')?.textContent).toBe('a')
    expect(player.currentTime()).toBe(35)
    expect(player.audio.load).not.toHaveBeenCalled()
    expect(player.audio.play).not.toHaveBeenCalled()
    expect(player.audio.pause).not.toHaveBeenCalled()
    const cancel = new Event('cancel', { cancelable: true })
    dialog.dispatchEvent(cancel)
    flush()
    expect(cancel.defaultPrevented).toBe(true)
    expect(dialog.open).toBe(false)
    expect(document.activeElement).toBe(trigger)
  })

  it('队列切歌、移除及清空共用全局队列，清空后自动收起', async () => {
    mount()
    open()
    click('展开播放队列')
    click('播放 b')
    await vi.waitFor(() => expect(player.audio.src).toContain('/b.mp3'))
    flush()
    expect(player.currentSong()?.id).toBe('b')
    expect(dialog.querySelector('h1')?.textContent).toBe('b')
    click('移除 c')
    expect(player.playQueue().map(song => song.id)).toEqual(['a', 'b'])
    click('清空播放队列')
    await Promise.resolve()
    flush()
    expect(player.playQueue()).toEqual([])
    expect(dialog.open).toBe(false)
  })

  it('大队列初始只渲染当前曲目附近，仍能展开查看其他歌曲', async () => {
    const many = Array.from({ length: 500 }, (_, i) => ({ ...songs[0]!, id: String(i), title: `song-${i}` }))
    await player.setPlayQueue(many)
    await player.setCurrentIndex(250)
    flush()
    mount()
    open()
    click('展开播放队列')
    const list = dialog.querySelector('[aria-label="队列歌曲"]')!
    expect(list.querySelector('[aria-current="true"]')?.textContent).toContain('song-250')
    expect(list.querySelectorAll('[aria-haspopup="menu"]').length).toBeLessThan(100)
    ;([...list.querySelectorAll('button')].find(button => button.textContent?.includes('显示更多歌曲')) as HTMLButtonElement).click()
    flush()
    expect(list.querySelectorAll('[aria-haspopup="menu"]').length).toBeGreaterThan(100)
  })

  it('随机模式不重排队列界面，上一首和下一首按独立的随机顺序切歌', async () => {
    player.restorePlayerSession({
      queue: { items: songs, playMode: 'random', randomOrder: [0, 2, 1] },
      position: { song: { provider: 'bili', id: 'a' }, time: 0 },
    })
    flush()
    mount()
    open()
    click('展开播放队列')
    const queueOrder = () => [...dialog.querySelectorAll('[aria-label="队列歌曲"] button[aria-label^="播放 "]')].map(button => button.getAttribute('aria-label'))
    expect(queueOrder()).toEqual(['播放 a', '播放 b', '播放 c'])
    click('下一首')
    await vi.waitFor(() => expect(player.currentSong()?.id).toBe('c'))
    expect(queueOrder()).toEqual(['播放 a', '播放 b', '播放 c'])
    click('上一首')
    await vi.waitFor(() => expect(player.currentSong()?.id).toBe('a'))
    click('上一首')
    await vi.waitFor(() => expect(player.currentSong()?.id).toBe('b'))
    expect(queueOrder()).toEqual(['播放 a', '播放 b', '播放 c'])
  })

  it('暂停状态下切换音质保留暂停与进度', async () => {
    await player.setPlayQueue([{ ...songs[0]!, src: undefined }])
    player.audio.dispatchEvent(new Event('pause'))
    player.setCurrentTime(35)
    flush()
    vi.mocked(player.audio.play).mockClear()
    await selectQuality({ name: '192K', url: 'https://cdn.example/high.mp3' })
    flush()
    expect(player.audio.src).toBe('https://cdn.example/high.mp3')
    expect(player.currentTime()).toBe(35)
    expect(player.audio.play).not.toHaveBeenCalled()
  })
})
