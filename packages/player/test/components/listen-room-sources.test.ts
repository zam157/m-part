import { createComponent, render } from '@solidjs/web'
import { flush } from 'solid-js'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import ListenRoomSources from '~/components/ListenRoomSources/ListenRoomSources'
import { roomView, setRoomView, setRoomServer } from '~/composables/listen-room'
import type { RoomSnapshot } from '@m-part/listen-core/protocol'

const { manage, personal } = vi.hoisted(() => ({ manage: vi.fn(), personal: vi.fn() }))
vi.mock('~/composables/listen-room', async (original) => ({ ...await original<object>(), manageRoomSource: manage, usePersonalRoomSource: personal }))
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
  manage.mockReset().mockResolvedValue(false); personal.mockReset()
  setRoomServer('https://rooms.example')
  setRoomView({ connection: 'connected', status: 'ready', error: '', away: false, inSync: false, isHost: true })
  flush()
  container = document.createElement('div'); document.body.append(container)
  dispose = render(() => createComponent(ListenRoomSources, {}), container)
  flush()
})
afterEach(() => { dispose(); container.remove(); delete (HTMLDialogElement.prototype as Partial<HTMLDialogElement>).showModal; delete (HTMLDialogElement.prototype as Partial<HTMLDialogElement>).close; setRoomView(v => ({ ...v, isHost: false })); flush() })

it('opens the selected platform dialog and submits credentials only on explicit action', () => {
  open('netease')
  const input = container.querySelector<HTMLInputElement>('input')!
  expect(container.querySelector('dialog')!.open).toBe(true)
  expect(container.querySelector('dialog')!.textContent).toContain('网易云取源设置')
  input.value = 'MUSIC_U=private-session'
  input.dispatchEvent(new Event('input', { bubbles: true })); flush()
  expect(manage).not.toHaveBeenCalled()
  container.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })); flush()
  expect(manage).toHaveBeenCalledWith('credential', 'MUSIC_U=private-session', 'netease')
  expect(input.type).toBe('password')
  expect(input.value).toBe('')
  expect(localStorage.getItem('MUSIC_U')).toBeNull()
  expect(personal).not.toHaveBeenCalled()
})

it.each(['http://192.168.1.10:3410', 'http://rooms.example', 'https://rooms.example'])('restricts editing to the host and permits credentials using %s', (server) => {
  setRoomView(v => ({ ...v, isHost: false })); flush()
  expect(container.querySelector('dialog')).toBeNull()
  expect(container.querySelectorAll('[aria-label="各平台房间账号"] button')).toHaveLength(0)
  setRoomView(v => ({ ...v, isHost: true })); setRoomServer(server); flush()
  open('netease')
  const input = container.querySelector<HTMLInputElement>('input')!
  input.value = 'MUSIC_U=private-test-session'
  input.dispatchEvent(new Event('input', { bubbles: true })); flush()
  container.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })); flush()
  expect(manage).toHaveBeenCalledWith('credential', 'MUSIC_U=private-test-session', 'netease')
  expect(input.value).toBe('')
  expect(roomView().connection).toBe('connected')
})

it('clears an unsubmitted cookie on close and opens each platform independently', () => {
  open('netease')
  let input = container.querySelector<HTMLInputElement>('input')!
  input.value = 'must-not-cross-platforms'
  input.dispatchEvent(new Event('input', { bubbles: true })); flush()
  close(); expect(input.value).toBe('')
  open('qq'); input = container.querySelector<HTMLInputElement>('input')!
  expect(input.placeholder).toContain('qqmusic_key')
  expect(input.value).toBe('')
  input.value = 'qqmusic_uin=12345678; qqmusic_key=private'
  input.dispatchEvent(new Event('input', { bubbles: true })); flush()
  container.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })); flush()
  expect(manage).toHaveBeenLastCalledWith('credential', 'qqmusic_uin=12345678; qqmusic_key=private', 'qq')
  close(); open('bili')
  expect(input.placeholder).toContain('SESSDATA')
})

it('changes the selected platform mode and revokes its account within the dialog', () => {
  open('qq')
  container.querySelector<HTMLButtonElement>('[aria-label="QQ 音乐取源方式"] button:nth-child(2)')!.click(); flush()
  expect(manage).toHaveBeenCalledWith('source', 'hosted', 'qq')
  close()
  setRoomView(v => ({ ...v, snapshot: { source: { mode: 'hosted', version: 1, provider: 'qq', credential: 'none', accounts: { netease: { credential: 'ready', version: 1, label: '网易云账号 · 尾号 1234' }, bili: { credential: 'ready', version: 1, label: 'BiliBili 账号 · 尾号 5678' } } } } as RoomSnapshot })); flush()
  expect(container.textContent).toContain('QQ 音乐匿名托管')
  expect(container.querySelector('[data-platform=netease]')!.textContent).toContain('1234')
  expect(container.querySelector('[data-platform=bili]')!.textContent).toContain('5678')
  open('netease')
  const revoke = [...container.querySelectorAll<HTMLButtonElement>('dialog button')].find(button => button.textContent === '撤销账号')!
  revoke.click(); flush()
  expect(manage).toHaveBeenLastCalledWith('revoke', undefined, 'netease')
})
