import { afterEach, expect, it, vi } from 'vitest'
import { flush, untrack } from 'solid-js'
import { CLIENT_COOKIE_MODE_PREFIX, getClientCookie, getStoredClientCookie } from '@m-part/music/client-cookies'

vi.mock('@m-part/music/constants', () => ({ TARGET_EXTENSION: false }))
const { library, search } = vi.hoisted(() => ({ library: vi.fn(), search: vi.fn() }))
vi.mock('~/composables/playlists', () => ({ invalidatePlaylistCredentials: library }))
vi.mock('~/composables/search', () => ({ invalidateSearchCredentials: search }))
import { clientCookieStatus, saveClientCookie, selectClientCookieMode, startClientCookieSettings } from '~/composables/client-cookies'

let dispose: (() => void) | undefined
afterEach(() => { dispose?.(); localStorage.clear(); library.mockClear(); search.mockClear() })

it('tracks saved values separately from the active mode and invalidates active sessions', async () => {
  dispose = startClientCookieSettings(); flush()
  await saveClientCookie('bili', 'SESSDATA=saved'); flush()
  expect(untrack(clientCookieStatus).configured.bili).toBe(true)
  expect(untrack(clientCookieStatus).modes.bili).toBe('website')
  expect(library).not.toHaveBeenCalled()
  await selectClientCookieMode('bili', 'manual'); flush()
  expect(getClientCookie('bili')).toBe('SESSDATA=saved')
  expect(library).toHaveBeenCalledExactlyOnceWith('bili')
  await selectClientCookieMode('bili', 'website'); flush()
  expect(getStoredClientCookie('bili')).toBe('SESSDATA=saved')
  await saveClientCookie('bili', ''); flush()
  expect(untrack(clientCookieStatus).configured.bili).toBe(false)
  expect(untrack(clientCookieStatus).modes.bili).toBe('website')
})

it('refreshes the selected mode and invalidates results when another tab changes it', () => {
  dispose = startClientCookieSettings(); flush()
  const key = CLIENT_COOKIE_MODE_PREFIX + 'qq'
  localStorage.setItem(key, 'manual')
  window.dispatchEvent(new StorageEvent('storage', { key, newValue: 'manual' })); flush()
  expect(untrack(clientCookieStatus).modes.qq).toBe('manual')
  expect(library).toHaveBeenCalledExactlyOnceWith('qq')
  expect(search).toHaveBeenCalledExactlyOnceWith('qq')
})
