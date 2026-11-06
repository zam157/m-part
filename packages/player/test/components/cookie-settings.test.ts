import { createComponent, render } from '@solidjs/web'
import { flush } from 'solid-js'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { mockDialog } from '../helpers/dialog'
import { setWebTransport } from '@m-part/music/web-transport'

const { definitions, save } = vi.hoisted(() => ({
  definitions: [{ name: 'bili', cookie: { label: '测试音源', placeholder: 'session=…', loginUrl: 'https://example.test/' } }],
  save: vi.fn(async () => {}),
}))
vi.mock('@m-part/music/provider-definitions', () => ({ getCookieProviders: () => definitions }))
vi.mock('~/composables/dark', () => ({ colorMode: () => 'system', switchColorMode: vi.fn() }))
vi.mock('~/composables/client-cookies', () => ({ clientCookieStatus: () => ({ configured: {}, modes: {}, error: '' }), saveClientCookie: save, selectClientCookieMode: vi.fn() }))
import SettingsPage from '~/pages/settings'

let dispose: (() => void) | undefined
let restore: () => void
beforeEach(() => { restore = mockDialog() })
afterEach(() => { dispose?.(); restore(); document.body.replaceChildren(); localStorage.clear(); save.mockClear() })

it.each([['proxy', '匿名取源'], ['extension', '网站 Cookie']] as const)('opens the chosen Cookie form in %s mode and discards drafts on close', async (transport, sourceLabel) => {
  setWebTransport(transport)
  dispose = render(() => createComponent(SettingsPage, {}), document.body)
  flush()
  const edit = document.querySelector<HTMLButtonElement>('button[aria-label="设置测试音源账号"]')!
  expect(document.querySelector('form')).toBeNull()
  edit.click(); flush()
  const dialog = document.querySelector('dialog[open]')!
  expect(dialog.querySelector('h2')?.textContent).toBe('测试音源账号')
  expect(dialog.querySelector('form')?.getAttribute('aria-label')).toBe('测试音源 Cookie 设置')
  expect(dialog.querySelector('[role="combobox"]')?.textContent).toBe(sourceLabel)
  expect(dialog.querySelector('a')?.href).toBe('https://example.test/')
  const input = dialog.querySelector('input')!
  expect(input.placeholder).toBe('session=…')
  input.value = 'session=test'
  input.dispatchEvent(new Event('input', { bubbles: true })); flush()
  dialog.querySelector<HTMLButtonElement>('button[type="submit"]')!.click()
  await Promise.resolve(); flush()
  expect(save).toHaveBeenCalledExactlyOnceWith('bili', 'session=test')
  input.value = 'session=discard'; input.dispatchEvent(new Event('input', { bubbles: true })); flush()
  dialog.dispatchEvent(new Event('cancel', { cancelable: true })); flush()
  expect(document.querySelector('form')).toBeNull()
  edit.click(); flush()
  expect(dialog.querySelector('input')?.value).toBe('')
})
