import type { ProviderName } from '../types/provider'

/** API destinations only; never classify artwork, audio CDNs or a room server as a credential target. */
export function providerRequest(value: string) {
  let url: URL
  try { url = new URL(value) }
  catch { return }
  if (url.protocol !== 'https:' || url.port || url.username || url.password || url.hash) return
  let provider: ProviderName | undefined
  if (url.hostname === 'api.bilibili.com' && url.pathname.startsWith('/x/')) provider = 'bili'
  if (url.hostname === 'music.163.com' && url.pathname.startsWith('/weapi/')) provider = 'netease'
  if (url.hostname === 'c.y.qq.com' && /^\/(?:soso|qzone|rsc|splcloud|v8)\//.test(url.pathname)) provider = 'qq'
  if (url.hostname === 'u.y.qq.com' && url.pathname === '/cgi-bin/musicu.fcg') provider = 'qq'
  return provider ? { provider, url } : undefined
}

export const providerCookieFilters = {
  bili: '^https://api\\.bilibili\\.com/x/',
  netease: '^https://music\\.163\\.com/weapi/',
  qq: '^https://(c\\.y\\.qq\\.com/(soso|qzone|rsc|splcloud|v8)/|u\\.y\\.qq\\.com/cgi-bin/musicu\\.fcg([?]|$))',
} as const

export const providerOrigins = { bili: 'https://www.bilibili.com', netease: 'https://music.163.com', qq: 'https://y.qq.com' } as const
