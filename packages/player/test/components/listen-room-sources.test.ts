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
beforeEach(() => {
  manage.mockReset().mockResolvedValue(false); personal.mockReset()
  setRoomServer('https://rooms.example')
  setRoomView({ connection: 'connected', status: 'ready', error: '', away: false, inSync: false, isHost: true })
  flush()
  container = document.createElement('div'); document.body.append(container)
  dispose = render(() => createComponent(ListenRoomSources, {}), container)
  flush()
})
afterEach(() => { dispose(); container.remove(); setRoomView(v => ({ ...v, isHost: false })); flush() })

it('submits credentials only after a host action and immediately clears the password input', async () => {
  const input = container.querySelector<HTMLInputElement>('input')!
  input.value = 'MUSIC_U=private-session'
  input.dispatchEvent(new Event('input', { bubbles: true })); flush()
  expect(manage).not.toHaveBeenCalled()
  container.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
  flush()
  expect(manage).toHaveBeenCalledWith('credential', 'MUSIC_U=private-session', 'netease')
  expect(input.type).toBe('password')
  expect(input.value).toBe('')
  expect(localStorage.getItem('MUSIC_U')).toBeNull()
  expect(personal).not.toHaveBeenCalled()
})

it('hides credential management from members and keeps HTTP LAN independent mode usable', () => {
  setRoomView(v => ({ ...v, isHost: false })); flush()
  expect(container.querySelector('form')).toBeNull()
  setRoomView(v => ({ ...v, isHost: true })); setRoomServer('http://192.168.1.10:3410'); flush()
  expect(container.querySelector<HTMLInputElement>('input')!.disabled).toBe(true)
  expect(container.textContent).toContain('仍可使用各自取源')
  expect(roomView().connection).toBe('connected')
})

it('selects each platform explicitly and clears credentials when switching platforms', () => {
  const select = container.querySelector<HTMLSelectElement>('select')!
  const input = container.querySelector<HTMLInputElement>('input')!
  input.value = 'must-not-cross-platforms'
  input.dispatchEvent(new Event('input', { bubbles: true })); flush()
  select.value = 'qq'; select.dispatchEvent(new Event('change', { bubbles: true })); flush()
  expect(input.value).toBe('')
  expect(input.placeholder).toContain('qqmusic_key')
  input.value = 'qqmusic_uin=12345678; qqmusic_key=private'
  input.dispatchEvent(new Event('input', { bubbles: true })); flush()
  container.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })); flush()
  expect(manage).toHaveBeenLastCalledWith('credential', 'qqmusic_uin=12345678; qqmusic_key=private', 'qq')
  select.value = 'bili'; select.dispatchEvent(new Event('change', { bubbles: true })); flush()
  expect(input.placeholder).toContain('SESSDATA')
  input.value = 'SESSDATA=private'
  input.dispatchEvent(new Event('input', { bubbles: true })); flush()
  container.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })); flush()
  expect(manage).toHaveBeenLastCalledWith('credential', 'SESSDATA=private', 'bili')
})

it('enables hosted mode without cookies and manages each account separately', () => {
  const enable = Array.from(container.querySelectorAll('button')).find(b => b.textContent === '全员使用服务器音源')!
  expect(enable.disabled).toBe(false); enable.click(); flush()
  expect(manage).toHaveBeenCalledWith('source', 'hosted')
  setRoomView(v => ({ ...v, snapshot: { source: { mode: 'hosted', version: 1, provider: 'qq', credential: 'none', accounts: { netease: { credential: 'ready', version: 1, label: '网易云账号 · 尾号 1234' }, bili: { credential: 'ready', version: 1, label: 'BiliBili 账号 · 尾号 5678' } } } } as RoomSnapshot })); flush()
  expect(container.textContent).toContain('QQ 音乐匿名托管')
  expect(container.querySelector('[data-platform=netease]')!.textContent).toContain('1234')
  expect(container.querySelector('[data-platform=bili]')!.textContent).toContain('5678')
  container.querySelector<HTMLButtonElement>('[data-platform=netease] button')!.click(); flush()
  expect(manage).toHaveBeenLastCalledWith('revoke', undefined, 'netease')
  setRoomView(v => ({ ...v, isHost: false })); flush()
  expect(container.querySelectorAll('[aria-label="各平台房间账号"] button')).toHaveLength(0)
})
