import { createComponent, render } from '@solidjs/web'
import { flush } from 'solid-js'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import type { RoomSnapshot } from '@m-part/listen-core/protocol'
import ListenRoomHistory from '~/components/ListenRoomHistory/ListenRoomHistory'
import { setRoomView } from '~/composables/listen-room'

const { send } = vi.hoisted(() => ({ send: vi.fn() }))
vi.mock('~/composables/listen-room', async original => ({ ...await original<object>(), sendRoomChat: send }))
vi.mock('@m-part/music/providers', () => ({ providers: {} }))
let container: HTMLDivElement
let dispose: () => void
const history: RoomSnapshot['history'] = [
  { id: 1, at: 1_800_000_000_000, kind: 'operation', memberId: 'host', name: '房主', text: '创建了房间' },
  { id: 2, at: 1_800_000_001_000, kind: 'chat', memberId: 'member', name: '朋友', text: '<img src=x onerror=alert(1)>' },
]
function view(entries = history) {
  // This component only consumes the history slice of the snapshot.
  setRoomView({ connection: 'connected', status: 'ready', error: '', away: false, inSync: false, isHost: false, snapshot: { history: entries } as RoomSnapshot })
  flush()
}
function draft(text: string) {
  const input = container.querySelector('textarea')!
  input.value = text; input.dispatchEvent(new Event('input', { bubbles: true })); flush()
  return input
}
function submit() { container.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })); flush() }
async function settled() { await Promise.resolve(); await Promise.resolve(); flush() }
beforeEach(() => {
  send.mockReset().mockResolvedValue(true); view()
  container = document.createElement('div'); document.body.append(container)
  dispose = render(() => createComponent(ListenRoomHistory, {}), container); flush()
})
afterEach(() => { dispose(); container.remove() })

it('renders untrusted chat as text and filters chat separately from operations', () => {
  expect(container.querySelector('article img')).toBeNull()
  expect(container.querySelectorAll('article')).toHaveLength(2)
  expect(container.textContent).toContain('<img src=x onerror=alert(1)>')
  const filters = container.querySelectorAll<HTMLButtonElement>('[aria-label="记录筛选"] button')
  filters[1]!.click(); flush()
  expect(container.querySelectorAll('article')).toHaveLength(1)
  expect(container.querySelector('article')!.textContent).toContain('朋友')
  filters[2]!.click(); flush()
  expect(container.querySelectorAll('article')).toHaveLength(1)
  expect(container.querySelector('article')!.textContent).toContain('创建了房间')
})

it('clears only acknowledged drafts and retains text on failure without resending', async () => {
  const input = draft('保留消息'); send.mockResolvedValueOnce(false); submit(); await settled()
  expect(input.value).toBe('保留消息'); expect(send).toHaveBeenCalledTimes(1)
  submit(); await settled()
  expect(input.value).toBe(''); expect(send).toHaveBeenCalledTimes(2)
})

it('sends on Enter without adding a newline and ignores a held Enter key', async () => {
  const input = draft('键盘发送')
  const enter = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true })
  input.dispatchEvent(enter); flush()
  input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', repeat: true, bubbles: true, cancelable: true })); flush()
  expect(enter.defaultPrevented).toBe(true)
  expect(send).toHaveBeenCalledExactlyOnceWith('键盘发送')
  await settled()
  expect(input.value).toBe('')
})

it.each([
  { name: 'Shift+Enter newline', shiftKey: true },
  { name: 'IME composition', isComposing: true },
  { name: 'IME confirmation fallback', keyCode: 229 },
])('keeps the native behavior for $name without sending', ({ name: _, ...options }) => {
  const input = draft('尚未发送')
  const enter = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true, ...options })
  input.dispatchEvent(enter); flush()
  expect(enter.defaultPrevented).toBe(false)
  expect(send).not.toHaveBeenCalled()
  expect(input.value).toBe('尚未发送')
})

it('preserves new typing while a previous message awaits acknowledgement and blocks double submit', async () => {
  let ack!: (ok: boolean) => void
  send.mockImplementationOnce(() => new Promise<boolean>(resolve => { ack = resolve }))
  draft('第一条'); submit(); draft('下一条'); submit()
  expect(send).toHaveBeenCalledTimes(1)
  ack(true); await settled()
  expect(container.querySelector('textarea')!.value).toBe('下一条')
  setRoomView(v => ({ ...v, connection: 'reconnecting' })); flush(); submit()
  expect(send).toHaveBeenCalledTimes(1)
})

it('does not force scrolling while reading older records and offers a return to latest button', () => {
  const list = container.querySelector<HTMLDivElement>('[aria-label="房间记录"]')!
  Object.defineProperties(list, { scrollHeight: { value: 1_000 }, clientHeight: { value: 200 } })
  list.scrollTop = 100; list.dispatchEvent(new Event('scroll')); flush()
  view([...history, { id: 3, at: 1_800_000_002_000, kind: 'chat', text: '新消息' }])
  expect(list.scrollTop).toBe(100)
  const button = Array.from(container.querySelectorAll('button')).find(button => button.textContent === '有新记录，查看最新')!
  expect(button).toBeTruthy(); button.click(); flush()
  expect(list.scrollTop).toBe(1_000)
  expect(container.textContent).not.toContain('有新记录，查看最新')
})
