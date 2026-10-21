import type { TooltipProps, TooltipTriggerProps } from '~/components/Tooltip/Tooltip'
import { createComponent, render } from '@solidjs/web'
import { flush } from 'solid-js'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import MusicPlayer from '~/components/MusicPlayer/MusicPlayer'

vi.mock('#shared/utils/providers', () => ({ providers: {} }))
vi.mock('~/components/Tooltip/Tooltip', () => ({ default: (props: TooltipProps) => props.children({} as TooltipTriggerProps) }))
const player = await import('~/composables/player')
let container: HTMLDivElement
let dispose: (() => void) | undefined
let slider: HTMLDivElement

beforeEach(async () => {
  vi.spyOn(player.audio, 'pause').mockImplementation(() => {})
  vi.spyOn(player.audio, 'load').mockImplementation(() => {})
  vi.spyOn(player.audio, 'play').mockResolvedValue()
  await player.setPlayQueue([{ provider: 'bili', id: '1', title: '歌曲', duration: 200, coverUrl: '', src: 'https://cdn.example/song.mp3' }])
  Object.defineProperty(player.audio, 'duration', { configurable: true, value: 200 })
  player.audio.dispatchEvent(new Event('durationchange'))
  player.audio.dispatchEvent(new Event('loadeddata'))
  player.setCurrentTime(20)
  flush()
  container = document.createElement('div')
  document.body.append(container)
  dispose = render(() => createComponent(MusicPlayer, {}), container)
  flush()
  slider = container.querySelector('[aria-label="播放进度"]')!
  vi.spyOn(slider, 'getBoundingClientRect').mockReturnValue({ left: 100, width: 200 } as DOMRect)
  Object.assign(slider, { setPointerCapture: vi.fn(), hasPointerCapture: () => true, releasePointerCapture: vi.fn() })
})

afterEach(() => {
  dispose?.()
  container.remove()
  Reflect.deleteProperty(player.audio, 'duration')
  vi.restoreAllMocks()
})

function pointer(type: string, x: number) {
  const event = new MouseEvent(type, { bubbles: true, clientX: x, button: 0 })
  Object.defineProperty(event, 'pointerId', { value: 1 })
  slider.dispatchEvent(event)
  flush()
}

describe('播放栏交互', () => {
  it('拖动只预览进度，释放时按最终位置跳转；单击也能跳转', () => {
    pointer('pointerdown', 150)
    pointer('pointermove', 200)
    expect(player.audio.currentTime).toBe(20)
    expect(slider.getAttribute('aria-valuenow')).toBe('100')
    pointer('pointerup', 250)
    expect(player.audio.currentTime).toBe(150)
    pointer('pointerdown', 150)
    pointer('pointerup', 150)
    expect(player.audio.currentTime).toBe(50)
  })

  it('取消拖动不会改变实际播放位置或在后续释放时误跳转', () => {
    pointer('pointerdown', 150)
    pointer('pointermove', 250)
    pointer('pointercancel', 250)
    pointer('pointerup', 250)
    expect(player.audio.currentTime).toBe(20)
    expect(slider.getAttribute('aria-valuenow')).toBe('20')
  })

  it('键盘按五秒调整进度，首尾跳转遵守歌曲时长边界', () => {
    const key = (value: string) => {
      slider.dispatchEvent(new KeyboardEvent('keydown', { key: value, bubbles: true, cancelable: true }))
      flush()
    }
    key('ArrowRight')
    expect(player.audio.currentTime).toBe(25)
    key('Home')
    key('ArrowLeft')
    expect(player.audio.currentTime).toBe(0)
    key('End')
    key('ArrowRight')
    expect(player.audio.currentTime).toBe(200)
  })
})
