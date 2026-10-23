import { encryptWeapi } from '@m-part/music/providers/netease-crypto'
import { HostedSourceError, limitedJson } from './shared'
import type { HostedProvider } from './shared'

/** Only these two cookies can reach the fixed NetEase API host. */
export function parseNeteaseCookie(input: string) {
  if (input.length > 4096 || /[\r\n\x00-\x1f\x7f]/.test(input)) throw new HostedSourceError('登录凭据格式不正确')
  const cookies = new Map(input.split(';').map(part => { const at = part.indexOf('='); return [part.slice(0, at).trim(), part.slice(at + 1).trim()] }))
  const music = cookies.get('MUSIC_U')
  const csrf = cookies.get('__csrf') ?? ''
  if (!music || !/^[\w%+/.=-]{16,2048}$/.test(music) || (csrf && !/^[\da-f]{16,64}$/i.test(csrf))) throw new HostedSourceError('请填写包含 MUSIC_U 的网易云登录 Cookie')
  return `MUSIC_U=${music};${csrf ? ` __csrf=${csrf};` : ''}`
}

/** The CDN allowlist applies again after every redirect; no arbitrary proxy URL. */
export function validateNeteaseMediaUrl(input: string) {
  const url = new URL(input)
  if (url.protocol === 'http:') url.protocol = 'https:'
  if (url.protocol !== 'https:' || url.username || url.password || url.port || url.hash || !url.hostname.endsWith('.music.126.net')) throw new HostedSourceError('房间音源地址不在允许的网易云 CDN 范围内')
  return url.href
}

export function createNeteaseHostedProvider(fetcher: typeof fetch = fetch): HostedProvider {
  async function request(path: string, cookie: string, data: Record<string, unknown>, signal: AbortSignal) {
    const csrf = /(?:^|;)\s*__csrf=([^;]+)/.exec(cookie)?.[1] ?? ''
    const response = await fetcher(`https://music.163.com/weapi/${path}`, {
      method: 'POST', redirect: 'manual', credentials: 'omit',
      signal: AbortSignal.any([signal, AbortSignal.timeout(10_000)]),
      headers: { 'content-type': 'application/x-www-form-urlencoded', cookie, referer: 'https://music.163.com/' },
      body: new URLSearchParams(encryptWeapi({ ...data, csrf_token: csrf })),
    })
    if (!response.ok) { await response.body?.cancel(); throw new HostedSourceError('网易云托管请求失败，可能需要重新登录或稍后重试', [401, 403].includes(response.status)) }
    const result = await limitedJson(response, '网易云')
    if (result.code !== 200) throw new HostedSourceError('网易云会话不可用或需要验证，请重新绑定或稍后重试', [301, 401, 403].includes(result.code))
    return result
  }
  return {
    parseCookie: parseNeteaseCookie, validateMediaUrl: validateNeteaseMediaUrl,
    async validate(cookie, signal) {
      const result = await request('w/nuser/account/get', cookie, {}, signal)
      const id = result.profile?.userId
      if (!result.account || !Number.isSafeInteger(id)) throw new HostedSourceError('网易云登录凭据已失效，请重新登录', true)
      return `网易云账号 · 尾号 ${String(id).slice(-4)}`
    },
    async resolve(cookie, id, signal) {
      if (!/^\d{1,20}$/.test(id)) throw new HostedSourceError('网易云歌曲 ID 无效')
      const result = await request('song/enhance/player/url', cookie, { ids: JSON.stringify([id]), br: 320000 }, signal)
      const item = Array.isArray(result.data) ? result.data.find((entry: { id?: unknown }) => String(entry.id) === id) : undefined
      if (!item || item.code !== 200 || !item.url) throw new HostedSourceError('房间账号没有完整音源，可能需要会员、登录或版权权限')
      if (item.freeTrialInfo) throw new HostedSourceError('房间账号只能试听，无法使用完整歌曲时间轴一起听')
      return {
        url: validateNeteaseMediaUrl(item.url),
        hash: typeof item.md5 === 'string' && /^[a-f\d]{32}$/i.test(item.md5) ? item.md5.toLowerCase() : undefined,
        size: Number.isSafeInteger(item.size) && item.size > 0 ? item.size : undefined,
      }
    },
  }
}
