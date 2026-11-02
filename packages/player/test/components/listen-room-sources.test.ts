import { createComponent, render } from '@solidjs/web'
import { flush } from 'solid-js'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import ListenRoomSources from '~/components/ListenRoomSources/ListenRoomSources'
import { setRoomView, setRoomServer } from '~/composables/listen-room'
import type { RoomSnapshot } from '@m-part/listen-core/protocol'

const { manage, personal, sync, navigate } = vi.hoisted(() => ({ manage: vi.fn(), personal: vi.fn(), sync: vi.fn(), navigate: vi.fn() }))
vi.mock('@solidjs/router', () => ({ useNavigate: () => navigate }))
vi.mock('~/composables/listen-room', async (original) => ({ ...await original<object>(), manageRoomSource: manage, usePersonalRoomSource: personal, syncRoomCredentials: sync }))
vi.mock('@m-part/music/providers', () => ({ providers: {} }))
let container: HTMLDivElement
let dispose: () => void
function open(platform: string) {
  container.querySelector<HTMLButtonElement>(`[data-platform=${platform}] button`)!.click(); flush()
}
function close() {
  container.querySelector<HTMLButtonElement>('[aria-label="关闭取源设置"]')!.click(); flush()
}
beforeEach(() => {
  Object.defineProperty(HTMLDialogElement.prototype, 'showModal', { configurable: true, value(this: HTMLDialogElement) { this.open = true } })
  Object.defineProperty(HTMLDialogElement.prototype, 'close', { configurable: true, value(this: HTMLDialogElement) { this.open = false; this.dispatchEvent(new Event('close')) } })
  manage.mockReset().mockResolvedValue(false); personal.mockReset(); sync.mockReset().mockResolvedValue(true); navigate.mockReset()
  setRoomServer('https://rooms.example')
  setRoomView({ connection: 'connected', status: 'ready', error: '', away: false, inSync: false, isHost: true })
  flush()
  container = document.createElement('div'); document.body.append(container)
  dispose = render(() => createComponent(ListenRoomSources, {}), container)
  flush()
})
afterEach(() => { dispose(); container.remove(); delete (HTMLDialogElement.prototype as Partial<HTMLDialogElement>).showModal; delete (HTMLDialogElement.prototype as Partial<HTMLDialogElement>).close; setRoomView(v => ({ ...v, isHost: false })); flush() })

it('offers the current client session and a separate room Cookie input', () => {
  setRoomView(v => ({ ...v, snapshot: { source: { mode: 'hosted', modes: { netease: 'hosted' } } } as RoomSnapshot })); flush()
  open('netease')
  expect(container.querySelector('dialog')!.open).toBe(true)
  expect(container.querySelector('dialog')!.textContent).toContain('网易云取源设置')
  expect(container.querySelector('input')?.type).toBe('password')
  const button = [...container.querySelectorAll<HTMLButtonElement>('dialog button')].find(b => b.textContent === '使用音源设置 Cookie')!
  button.click(); flush()
  expect(sync).toHaveBeenCalledExactlyOnceWith('netease')
  expect(manage).not.toHaveBeenCalled()
})
it('submits a room-only Cookie explicitly and clears the draft when closing or changing platform', () => {
  open('netease')
  const input = container.querySelector<HTMLInputElement>('input')!
  input.value = 'MUSIC_U=room-private'
  input.dispatchEvent(new Event('input', { bubbles: true })); flush()
  container.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })); flush()
  expect(manage).toHaveBeenCalledExactlyOnceWith('credential', 'MUSIC_U=room-private', 'netease')
  expect(input.value).toBe('')
  input.value = 'not-submitted'; input.dispatchEvent(new Event('input', { bubbles: true })); flush()
  close(); open('qq')
  expect(input.value).toBe('')
  expect(input.placeholder).toContain('qqmusic_key')
})

it('only lets hosts manage source settings and navigates to the shared Cookie settings', () => {
  setRoomView(v => ({ ...v, isHost: false })); flush()
  expect(container.querySelector('dialog')).toBeNull()
  expect(container.querySelectorAll('[aria-label="各平台房间账号"] button')).toHaveLength(0)
  setRoomView(v => ({ ...v, isHost: true })); flush()
  open('qq')
  const button = [...container.querySelectorAll<HTMLButtonElement>('dialog button')].find(b => b.textContent === '前往音源设置')!
  button.click(); flush()
  expect(navigate).toHaveBeenCalledExactlyOnceWith('/settings')
  expect(container.querySelector('dialog')!.open).toBe(false)
})

it('changes source modes independently and shows scoped account synchronization errors', () => {
  setRoomView(v => ({ ...v, snapshot: undefined, sourceErrors: { bili: '请更新音源设置' } })); flush()
  open('qq')
  container.querySelector<HTMLButtonElement>('[aria-label="QQ 音乐取源方式"] button:nth-child(2)')!.click(); flush()
  expect(manage).toHaveBeenCalledWith('source', 'hosted', 'qq')
  close(); open('bili')
  expect(container.querySelector('dialog')!.textContent).toContain('BiliBili取源设置')
  expect(container.querySelector('[data-platform=bili]')!.textContent).toContain('请更新音源设置')
})
