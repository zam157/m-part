import { createComponent, render } from '@solidjs/web'
import { flush } from 'solid-js'
import { afterEach, expect, it, vi } from 'vitest'

const { definitions, save } = vi.hoisted(() => ({
  definitions: [{ name: 'bili', cookie: { label: '测试音源', placeholder: 'session=…', loginUrl: 'https://example.test/' } }],
  save: vi.fn(async () => {}),
}))
vi.mock('@m-part/music/provider-definitions', () => ({ getCookieProviders: () => definitions }))
vi.mock('~/composables/client-cookies', () => ({ clientCookieStatus: () => ({ configured: {}, error: '' }), saveClientCookie: save }))
import SettingsPage from '~/pages/settings'

let dispose: (() => void) | undefined
afterEach(() => { dispose?.(); document.body.replaceChildren(); save.mockClear() })

it('renders exactly the declared Cookie providers, including their labels, hints and login links', async () => {
  dispose = render(() => createComponent(SettingsPage, {}), document.body)
  flush()
  expect(document.querySelectorAll('form')).toHaveLength(1)
  expect(document.querySelector('form')?.getAttribute('aria-label')).toBe('测试音源 Cookie 设置')
  expect(document.querySelector('a')?.href).toBe('https://example.test/')
  const input = document.querySelector('input')!
  expect(input.placeholder).toBe('session=…')
  input.value = 'session=test'
  input.dispatchEvent(new Event('input', { bubbles: true })); flush()
  document.querySelector('button[type="submit"]')!.dispatchEvent(new MouseEvent('click', { bubbles: true }))
  await Promise.resolve(); flush()
  expect(save).toHaveBeenCalledExactlyOnceWith('bili', 'session=test')
})
