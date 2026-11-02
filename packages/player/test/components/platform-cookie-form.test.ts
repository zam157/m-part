import { createComponent, render } from '@solidjs/web'
import { createSignal, flush } from 'solid-js'
import { afterEach, expect, it, vi } from 'vitest'
const { save, selectMode } = vi.hoisted(() => ({ save: vi.fn(), selectMode: vi.fn() }))
const [mode, setMode] = createSignal<'manual' | 'website'>('manual')
vi.mock('~/composables/client-cookies', () => ({ clientCookieStatus: () => ({ configured: { bili: true }, modes: { bili: mode() } }), saveClientCookie: save, selectClientCookieMode: selectMode }))
import { biliDefinition } from '@m-part/music/providers/bilibili-definition'
import PlatformCookieForm from '~/components/PlatformCookieForm/PlatformCookieForm'
let dispose: () => void
afterEach(() => { dispose?.(); document.body.replaceChildren(); save.mockReset(); selectMode.mockReset(); setMode('manual'); flush() })
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
it('clears only the saved Cookie and keeps failures retryable', async () => {
  save.mockRejectedValueOnce(new Error('保存失败'))
  mount()
  button('清除 Cookie').click(); await Promise.resolve(); await Promise.resolve(); flush()
  expect(save).toHaveBeenCalledWith('bili', '')
  expect(document.querySelector('[role="alert"]')?.textContent).toBe('保存失败')
  save.mockResolvedValueOnce(undefined)
  button('清除 Cookie').click(); await Promise.resolve(); await Promise.resolve(); flush()
  expect(document.querySelector('[role="status"]')?.textContent).toContain('已清除')
  expect(selectMode).not.toHaveBeenCalled()
})
it('switches the source independently without clearing saved Cookies or the unsaved input', async () => {
  selectMode.mockImplementation(async (_source, next) => { setMode(next) })
  mount()
  const input = document.querySelector('input')!
  input.value = 'SESSDATA=draft'; input.dispatchEvent(new Event('input', { bubbles: true })); flush()
  const select = document.querySelector('select')!
  expect([...select.options].map(option => option.text)).toEqual(['手动 Cookie', '网站 Cookie'])
  select.value = 'website'; select.dispatchEvent(new Event('change', { bubbles: true }))
  await Promise.resolve(); await Promise.resolve(); flush()
  expect(selectMode).toHaveBeenCalledExactlyOnceWith('bili', 'website')
  expect(select.value).toBe('website')
  expect(input.value).toBe('SESSDATA=draft')
  expect(save).not.toHaveBeenCalled()
})
it('keeps the previous selection when switching source fails', async () => {
  selectMode.mockRejectedValueOnce(new Error('切换失败'))
  mount()
  const select = document.querySelector('select')!
  select.value = 'website'; select.dispatchEvent(new Event('change', { bubbles: true }))
  await Promise.resolve(); await Promise.resolve(); flush()
  expect(select.value).toBe('manual')
  expect(document.querySelector('[role="alert"]')?.textContent).toBe('切换失败')
})
