import { createComponent, render } from '@solidjs/web'
import { flush } from 'solid-js'
import { afterEach, expect, it, vi } from 'vitest'
const { save } = vi.hoisted(() => ({ save: vi.fn() }))
vi.mock('~/composables/client-cookies', () => ({ clientCookieStatus: () => ({ configured: { bili: true } }), saveClientCookie: save }))
import { biliDefinition } from '@m-part/music/providers/bilibili-definition'
import PlatformCookieForm from '~/components/PlatformCookieForm/PlatformCookieForm'
let dispose: () => void
afterEach(() => { dispose?.(); document.body.replaceChildren(); save.mockReset() })
function mount() { dispose = render(() => createComponent(PlatformCookieForm, { source: 'bili', config: biliDefinition.cookie }), document.body); flush() }
const button = (text: string) => [...document.querySelectorAll('button')].find(b=>b.textContent === text)!
it('never pre-fills the stored cookie, prevents duplicate saves, and clears the input after success', async () => {
  let finish!: () => void
  save.mockImplementation(() => new Promise<void>(r=>{finish=r}))
  mount()
  const input = document.querySelector('input')!
  expect(input.type).toBe('password')
  expect(input.value).toBe('')
  input.value = 'SESSDATA=manual'; input.dispatchEvent(new Event('input', { bubbles: true })); flush()
  button('更新 Cookie').click(); flush()
  document.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })); flush()
  expect(save).toHaveBeenCalledExactlyOnceWith('bili', 'SESSDATA=manual')
  finish(); await Promise.resolve(); await Promise.resolve(); flush()
  expect(input.value).toBe('')
  expect(document.querySelector('[role="status"]')?.textContent).toContain('已保存')
})
it('clears only the chosen provider to restore website cookies and keeps failures retryable', async () => {
  save.mockRejectedValueOnce(new Error('保存失败'))
  mount()
  button('恢复网站 Cookie').click(); await Promise.resolve(); await Promise.resolve(); flush()
  expect(save).toHaveBeenCalledWith('bili', '')
  expect(document.querySelector('[role="alert"]')?.textContent).toBe('保存失败')
  save.mockResolvedValueOnce(undefined)
  button('恢复网站 Cookie').click(); await Promise.resolve(); await Promise.resolve(); flush()
  expect(document.querySelector('[role="status"]')?.textContent).toContain('已恢复')
})
