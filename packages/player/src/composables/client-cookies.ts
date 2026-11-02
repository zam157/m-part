import type { ProviderName } from '@m-part/music/types/provider'
import { CLIENT_COOKIE_PREFIX, getClientCookie, setClientCookie } from '@m-part/music/client-cookies'
import { getCookieProviders } from '@m-part/music/provider-definitions'
import { createSignal } from 'solid-js'
import { invalidatePlaylistCredentials } from './playlists'
import { invalidateSearchCredentials } from './search'

export const [clientCookieStatus, setClientCookieStatus] = createSignal<{ configured: Partial<Record<ProviderName, boolean>>, error: string }>({ configured: {}, error: '' })

export function refreshClientCookieStatus() {
  try {
    const configured = Object.fromEntries(getCookieProviders().map(({ name }) => [name, !!getClientCookie(name)]))
    setClientCookieStatus({ configured, error: '' })
  }
  catch { setClientCookieStatus(previous => ({ ...previous, error: '无法读取音源 Cookie 设置，请检查浏览器存储权限' })) }
}
function invalidate(source: ProviderName) {
  invalidatePlaylistCredentials(source)
  invalidateSearchCredentials(source)
}
export async function saveClientCookie(source: ProviderName, value: string) {
  await setClientCookie(source, value)
  refreshClientCookieStatus()
  invalidate(source)
}
export function startClientCookieSettings() {
  refreshClientCookieStatus()
  function changed(event: StorageEvent) {
    for (const { name } of getCookieProviders()) if (event.key === null || event.key === CLIENT_COOKIE_PREFIX + name) invalidate(name)
    refreshClientCookieStatus()
  }
  window.addEventListener('storage', changed)
  return () => window.removeEventListener('storage', changed)
}
