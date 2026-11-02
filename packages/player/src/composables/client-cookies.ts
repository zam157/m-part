import type { ProviderName } from '@m-part/music/types/provider'
import { CLIENT_COOKIE_PREFIX, CLIENT_COOKIE_MODE_PREFIX, getClientCookieMode, getStoredClientCookie, setClientCookie, setClientCookieMode, watchWebsiteSessionCookies } from '@m-part/music/client-cookies'
import type { ClientCookieMode } from '@m-part/music/client-cookies'
import { getCookieProviders } from '@m-part/music/provider-definitions'
import { createSignal } from 'solid-js'
import { invalidatePlaylistCredentials } from './playlists'
import { invalidateSearchCredentials } from './search'

export const [clientCookieStatus, setClientCookieStatus] = createSignal<{ configured: Partial<Record<ProviderName, boolean>>, modes: Partial<Record<ProviderName, ClientCookieMode>>, error: string }>({ configured: {}, modes: {}, error: '' })
export const CLIENT_SESSION_CHANGED = 'mpart-client-session-changed'
function sessionChanged(source: ProviderName) { window.dispatchEvent(new CustomEvent(CLIENT_SESSION_CHANGED, { detail: source })) }

export function refreshClientCookieStatus() {
  try {
    const configured = Object.fromEntries(getCookieProviders().map(({ name }) => [name, !!getStoredClientCookie(name)]))
    const modes = Object.fromEntries(getCookieProviders().map(({ name }) => [name, getClientCookieMode(name)]))
    setClientCookieStatus({ configured, modes, error: '' })
  }
  catch { setClientCookieStatus(previous => ({ ...previous, error: '无法读取音源 Cookie 设置，请检查浏览器存储权限' })) }
}
function invalidate(source: ProviderName) {
  invalidatePlaylistCredentials(source)
  invalidateSearchCredentials(source)
}
export async function saveClientCookie(source: ProviderName, value: string) {
  const active = getClientCookieMode(source) === 'manual'
  await setClientCookie(source, value)
  refreshClientCookieStatus()
  if (active) { invalidate(source); sessionChanged(source) }
}
export async function selectClientCookieMode(source: ProviderName, mode: ClientCookieMode) {
  await setClientCookieMode(source, mode)
  refreshClientCookieStatus()
  invalidate(source)
  sessionChanged(source)
}
export function startClientCookieSettings() {
  refreshClientCookieStatus()
  function changed(event: StorageEvent) {
    for (const { name } of getCookieProviders()) if (event.key === null || event.key === CLIENT_COOKIE_PREFIX + name || event.key === CLIENT_COOKIE_MODE_PREFIX + name) { invalidate(name); sessionChanged(name) }
    refreshClientCookieStatus()
  }
  window.addEventListener('storage', changed)
  const stopWebsite = watchWebsiteSessionCookies(source => { invalidate(source); sessionChanged(source) })
  return () => { window.removeEventListener('storage', changed); stopWebsite() }
}
