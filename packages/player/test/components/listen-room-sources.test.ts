import { createComponent, render } from '@solidjs/web'
import { flush } from 'solid-js'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import ListenRoomSources from '~/components/ListenRoomSources/ListenRoomSources'
import { roomView, setRoomView, setRoomServer } from '~/composables/listen-room'

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
  expect(manage).toHaveBeenCalledWith('credential', 'MUSIC_U=private-session')
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
