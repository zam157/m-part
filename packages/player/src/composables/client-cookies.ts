import type { ProviderName } from '@m-part/music/types/provider'
import { CLIENT_COOKIE_PREFIX, getClientCookie, setClientCookie } from '@m-part/music/client-cookies'
import { createSignal } from 'solid-js'
import { invalidatePlaylistCredentials } from './playlists'
import { invalidateSearchCredentials } from './search'

const sources: ProviderName[] = ['bili', 'netease', 'qq']
export const [clientCookieStatus, setClientCookieStatus] = createSignal({ configured: { bili: false, netease: false, qq: false }, error: '' })

export function refreshClientCookieStatus() {
  try {
    setClientCookieStatus({ configured: { bili: !!getClientCookie('bili'), netease: !!getClientCookie('netease'), qq: !!getClientCookie('qq') }, error: '' })
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
    for (const source of sources) if (event.key === null || event.key === CLIENT_COOKIE_PREFIX + source) invalidate(source)
    refreshClientCookieStatus()
  }
  window.addEventListener('storage', changed)
  return () => window.removeEventListener('storage', changed)
}
