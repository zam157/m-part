import { generateWbiSignInfo } from '@m-part/music/providers/bilibili-wbi'
import { parseBiliTrackId, selectBiliPage } from '@m-part/music/providers/bilibili-parts'
import { cookieHeader, HostedSourceError, limitedJson, withUpstreamDiagnostics, mediaUrl, selectedCookies } from './shared'
import type { HostedProvider } from './shared'

const headers = { referer: 'https://www.bilibili.com/', 'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36' }
export function parseBiliCookie(input: string) {
  const cookies = selectedCookies(input, ['SESSDATA', 'bili_jct', 'DedeUserID', 'DedeUserID__ckMd5', 'buvid3', 'buvid4'])
  if (!cookies.get('SESSDATA') || cookies.get('SESSDATA')!.length < 8) throw new HostedSourceError('请填写包含 SESSDATA 的 BiliBili 登录 Cookie')
  return cookieHeader(cookies)
}
export const validateBiliMediaUrl = (input: string) => mediaUrl(input, 'BiliBili', ['bilivideo.com', 'bilivideo.cn'])

export function createBiliHostedProvider(fetcher: typeof fetch = fetch): HostedProvider {
  async function request(path: string, cookie: string, params: Record<string, string | number>, signal: AbortSignal) {
    return withUpstreamDiagnostics({ provider: 'bili', phase: 'api', endpoint: path }, async (details) => {
      const url = new URL(`https://api.bilibili.com${path}`)
      for (const [key, value] of Object.entries(params)) url.searchParams.set(key, String(value))
      const response = await fetcher(url.href, { redirect: 'manual', credentials: 'omit', signal: AbortSignal.any([signal, AbortSignal.timeout(10_000)]), headers: { ...headers, ...(cookie ? { cookie } : {}) } })
      details.httpStatus = response.status
      if (!response.ok) { await response.body?.cancel(); throw new HostedSourceError('BiliBili 托管请求失败，请重新登录或稍后重试', response.status === 401) }
      const result = await limitedJson(response, 'BiliBili', path === '/x/web-interface/view' ? 1024 * 1024 : 128 * 1024)
      details.upstreamCodes = [result?.code]
      const anonymousNav = !cookie && path === '/x/web-interface/nav' && result?.code === -101 && result.data?.isLogin === false
      if ((result?.code !== 0 && !anonymousNav) || !result.data) throw new HostedSourceError('BiliBili 会话不可用、视频无权限或请求受限，请重新绑定或稍后重试', [-101, -111].includes(result?.code))
      return result.data
    })
  }
  return {
    parseCookie: parseBiliCookie, validateMediaUrl: validateBiliMediaUrl, mediaHeaders: headers,
    acceptsMediaType: type => type === 'video/mp4' || type === 'application/mp4',
    async validate(cookie, signal) {
      const data = await request('/x/web-interface/nav', cookie, {}, signal)
      if (!data.isLogin || !Number.isSafeInteger(data.mid) || data.mid <= 0) throw new HostedSourceError('BiliBili 登录凭据已失效，请重新登录', true)
      const expected = selectedCookies(cookie, ['DedeUserID']).get('DedeUserID')
      if (expected && expected !== String(data.mid)) throw new HostedSourceError('BiliBili 账号与会话不匹配，请重新登录', true)
      return `BiliBili 账号 · 尾号 ${String(data.mid).slice(-4)}`
    },
    async resolve(cookie, id, signal) {
      let identity
      try { identity = parseBiliTrackId(id) } catch { throw new HostedSourceError('BiliBili 视频或分 P 标识无效') }
      const view = await request('/x/web-interface/view', cookie, { bvid: identity.bvid }, signal)
      if (view.bvid !== identity.bvid) throw new HostedSourceError('BiliBili 未返回目标视频信息')
      let page
      try { page = selectBiliPage(view, identity.cid) } catch { throw new HostedSourceError('所选分 P 不存在、时长无效或不属于此视频，请重新选择') }
      const nav = await request('/x/web-interface/nav', cookie, {}, signal)
      if (cookie && !nav.isLogin) throw new HostedSourceError('BiliBili 登录凭据已失效，请重新登录', true)
      const keys = [nav.wbi_img?.img_url, nav.wbi_img?.sub_url].map(value => typeof value === 'string' ? /\/([a-f\d]{32})\.[a-z]+(?:\?.*)?$/i.exec(value)?.[1] : undefined)
      if (!keys[0] || !keys[1]) throw new HostedSourceError('BiliBili 签名信息不可用，请稍后重试')
      const params = { bvid: identity.bvid, cid: page.cid, fnval: 16, from_client: 'BROWSER', web_location: 1315873, fnver: 0 }
      const data = await request('/x/player/wbi/playurl', cookie, { ...params, ...generateWbiSignInfo(params, keys[0], keys[1]) }, signal)
      if (!Number.isFinite(data.timelength) || Math.abs(data.timelength / 1000 - page.duration) > Math.max(2, page.duration * 0.01) || data.is_preview || data.isPreview || data.durl?.length || !Array.isArray(data.dash?.audio)) throw new HostedSourceError('BiliBili 未提供所选分 P 的完整 DASH 音轨或仅允许试看')
      // AAC stereo only; do not select video, Dolby or Hi-Res tracks the browser may not decode.
      const audio = data.dash.audio.filter((item: { id?: number, codecs?: string }) => [30280, 30232, 30216].includes(item.id ?? 0) && typeof item.codecs === 'string' && /^mp4a\./i.test(item.codecs)).sort((a: { bandwidth: number }, b: { bandwidth: number }) => b.bandwidth - a.bandwidth)[0]
      if (!audio) throw new HostedSourceError('BiliBili 没有可播放的完整 AAC 音轨')
      // Primary URLs may use a peer CDN or custom port. Prefer a validated official backup.
      const candidates = [audio.baseUrl || audio.base_url, ...(audio.backupUrl || audio.backup_url || [])]
      let url: string | undefined
      for (const candidate of candidates) {
        if (typeof candidate !== 'string') continue
        try { url = validateBiliMediaUrl(candidate); break } catch {}
      }
      if (!url) throw new HostedSourceError('BiliBili 没有允许访问的音频 CDN，请稍后重试')
      // WBI signed URLs have no verified byte hash: expiry requires an explicit new source version.
      return { url }
    },
  }
}
