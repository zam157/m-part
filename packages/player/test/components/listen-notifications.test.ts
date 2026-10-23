import type { TooltipProps, TooltipTriggerProps } from '~/components/Tooltip/Tooltip'
import { createComponent, render } from '@solidjs/web'
import { flush } from 'solid-js'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import ListenRoomBar from '~/components/ListenRoomBar/ListenRoomBar'
import MusicPlayer from '~/components/MusicPlayer/MusicPlayer'
import { joinListenRoom, roomView, setRoomView } from '~/composables/listen-room'
import { audio, dismissPlaybackError, playbackError } from '~/composables/player'
import { setRoomPlayerHandler } from '~/composables/player-context'
import ListenPage from '~/pages/listen'

vi.mock('@solidjs/router', () => ({ useNavigate: () => vi.fn() }))
vi.mock('@m-part/music/providers', () => ({ providers: {} }))
vi.mock('~/components/Tooltip/Tooltip', () => ({ default: (props: TooltipProps) => props.children({} as TooltipTriggerProps) }))

const initialView = { connection: 'idle', status: 'loading' as const, error: '', away: false, inSync: false, isHost: false }
const alert = () => document.querySelector<HTMLDivElement>('[role="alert"]')!
let container: HTMLDivElement
let dispose: () => void

beforeEach(() => {
  vi.useFakeTimers()
  vi.spyOn(audio, 'pause').mockImplementation(() => {})
  const matches = HTMLElement.prototype.matches
  vi.spyOn(HTMLElement.prototype, 'matches').mockImplementation(function (this: HTMLElement, selector) {
    return selector === ':popover-open' ? this.hasAttribute('data-test-open') : matches.call(this, selector)
  })
  Object.defineProperties(HTMLElement.prototype, {
    showPopover: { configurable: true, value(this: HTMLElement) { this.setAttribute('data-test-open', '') } },
    hidePopover: { configurable: true, value(this: HTMLElement) { this.removeAttribute('data-test-open') } },
  })
  setRoomPlayerHandler(undefined)
  setRoomView(initialView)
  dismissPlaybackError()
  flush()
  container = document.createElement('div')
  document.body.append(container)
  dispose = render(() => [createComponent(ListenPage, {}), createComponent(ListenRoomBar, {}), createComponent(MusicPlayer, {})], container)
  flush()
})

afterEach(() => {
  dispose()
  container.remove()
  setRoomPlayerHandler(undefined)
  setRoomView(initialView)
  dismissPlaybackError()
  flush()
  vi.restoreAllMocks()
  Reflect.deleteProperty(HTMLElement.prototype, 'showPopover')
  Reflect.deleteProperty(HTMLElement.prototype, 'hidePopover')
  vi.useRealTimers()
})

describe('一起听错误通知', () => {
  it('房间与播放器同时失败时只显示一条浮层，关闭后不会露出旧错误', () => {
    const control = vi.fn()
    setRoomPlayerHandler(control)
    audio.dispatchEvent(new Event('error'))
    flush()
    const message = playbackError()!
    setRoomView({ ...initialView, connection: 'connected', status: 'failed', error: message, isHost: true })
    flush()
    expect(document.querySelectorAll('[role="alert"]')).toHaveLength(1)
    expect(alert().matches(':popover-open')).toBe(true)
    expect(alert().textContent).toContain(message)
    expect(container.textContent).not.toContain(message)
    expect(container.querySelector('[aria-label="一起听状态"]')?.textContent).toContain('本机音源不可用')
    alert().querySelector('button')!.click()
    expect(control).toHaveBeenCalledWith({ type: 'retry' })
    alert().querySelector<HTMLButtonElement>('[aria-label="关闭提示"]')!.click()
    flush()
    expect(roomView().error).toBe('')
    expect(playbackError()).toBeNull()
    expect(alert().matches(':popover-open')).toBe(false)
    // 清除后下一次相同失败仍可正常提示。
    setRoomView(v => ({ ...v, error: message }))
    flush()
    expect(alert().matches(':popover-open')).toBe(true)
  })

  it('入房校验失败也显示浮层，不插入占位错误块或底部状态栏，不提供播放重试', async () => {
    const before = container.textContent
    await joinListenRoom('http://127.0.0.1:3410', '听众', 'invalid')
    flush()
    expect(alert().textContent).toContain('一起听提示请输入 8 位房间码')
    expect(alert().matches(':popover-open')).toBe(true)
    expect(alert().querySelectorAll('button')).toHaveLength(1)
    expect(container.textContent).toBe(before)
    expect(container.querySelector('[aria-label="一起听状态"]')).toBeNull()
    vi.advanceTimersByTime(6000)
    flush()
    expect(roomView().error).toBe('')
    expect(alert().matches(':popover-open')).toBe(false)
  })

  it('普通播放失败仍显示原来的播放通知与重试入口', () => {
    audio.dispatchEvent(new Event('error'))
    flush()
    expect(alert().matches(':popover-open')).toBe(true)
    expect(alert().querySelector('h2')?.textContent).toBe('播放失败')
    expect(alert().querySelector('button')?.textContent).toBe('重试')
    expect(container.querySelector('[aria-label="一起听状态"]')).toBeNull()
  })

  it('房间持续更新同步状态时，同一条错误仍按时关闭且保留重试按钮', () => {
    setRoomPlayerHandler(vi.fn())
    setRoomView({ ...initialView, status: 'failed', error: '音源不可用' })
    flush()
    const retry = alert().querySelector('button')!
    for (let elapsed = 0; elapsed < 6000; elapsed += 250) {
      expect(alert().querySelector('button')).toBe(retry)
      vi.advanceTimersByTime(250)
      setRoomView(v => ({ ...v }))
      flush()
    }
    expect(roomView().error).toBe('')
    expect(alert().matches(':popover-open')).toBe(false)
  })
})
