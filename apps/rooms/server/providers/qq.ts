import { randomInt } from 'node:crypto'
import { qqToken } from '@m-part/music/providers/qq-crypto'
import { cookieHeader, HostedSourceError, limitedJson, withUpstreamDiagnostics, mediaUrl, selectedCookies } from './shared'
import type { HostedProvider } from './shared'

const names = ['qqmusic_uin', 'uin', 'wxuin', 'qqmusic_key', 'qm_keyst', 'p_skey', 'skey', 'eas_sid', 'login_type', 'tmeLoginType'] as const
function session(cookie: string) {
  const values = selectedCookies(cookie, names)
  const uin = [values.get('qqmusic_uin'), values.get('uin'), values.get('wxuin')].map(value => (value ?? '').replace(/^o0*/, '')).find(value => /^[1-9]\d{0,19}$/.test(value))
  const key = values.get('qqmusic_key') || values.get('qm_keyst') || values.get('p_skey') || values.get('skey')
  if (!uin || !key || key.length < 8) throw new HostedSourceError('请填写包含账号 UIN 和登录 key 的 QQ 音乐 Cookie')
  return { uin, key, token: qqToken(key), cookie: cookieHeader(values) }
}
export function parseQQCookie(input: string) { return session(input).cookie }
export const validateQQMediaUrl = (input: string) => mediaUrl(input, 'QQ 音乐', ['stream.qqmusic.qq.com', 'aqqmusic.tc.qq.com', 'isure.stream.qqmusic.qq.com'])

export function createQQHostedProvider(fetcher: typeof fetch = fetch): HostedProvider {
  async function rpc(cookie: string, module: string, method: string, param: Record<string, unknown>, signal: AbortSignal) {
    return withUpstreamDiagnostics({ provider: 'qq', phase: 'api', endpoint: `${module}.${method}` }, async (details) => {
      const login = cookie ? session(cookie) : { uin: '0', key: '', token: 5381, cookie: '' }
      const response = await fetcher('https://u.y.qq.com/cgi-bin/musicu.fcg', {
        method: 'POST', redirect: 'manual', credentials: 'omit', signal: AbortSignal.any([signal, AbortSignal.timeout(10_000)]),
        headers: { 'content-type': 'application/json', ...(cookie ? { cookie: login.cookie } : {}), referer: 'https://y.qq.com/', origin: 'https://y.qq.com' },
        body: JSON.stringify({ comm: { ct: 24, cv: 0, uin: login.uin, format: 'json', g_tk: login.token, authst: login.key, auth_tkn: login.token }, req_0: { module, method, param } }),
      })
      details.httpStatus = response.status
      if (!response.ok) { await response.body?.cancel(); throw new HostedSourceError('QQ 音乐托管请求失败，请重新登录或稍后重试', [401, 403].includes(response.status)) }
      const result = await limitedJson(response, 'QQ 音乐')
      const codes = [result?.code, result?.req_0?.code]
      details.upstreamCodes = codes
      if (codes.some(code => code !== 0) || !result.req_0.data) throw new HostedSourceError('QQ 音乐会话不可用或请求受限，请重新绑定或稍后重试', codes.some(code => [1000, 2000].includes(code)))
      return result.req_0.data
    })
  }
  return {
    parseCookie: parseQQCookie, validateMediaUrl: validateQQMediaUrl,
    mediaHeaders: { referer: 'https://y.qq.com/' },
    async validate(cookie, signal) {
      // Login-only RPC: a public profile lookup cannot prove that a key is valid.
      const data = await rpc(cookie, 'music.UserInfo.userInfoServer', 'GetLoginUserInfo', {}, signal)
      if (typeof data.info?.nick !== 'string' || !data.info.nick.trim()) throw new HostedSourceError('QQ 音乐登录凭据已失效或不完整，请重新登录', true)
      const uin = session(cookie).uin
      if (data.info.uin !== undefined && String(data.info.uin) !== uin) throw new HostedSourceError('QQ 音乐账号与会话不匹配，请重新登录', true)
      return `QQ 音乐账号 · 尾号 ${uin.slice(-4)}`
    },
    async resolve(cookie, id, signal) {
      if (!/^[a-z\d]{14}$/i.test(id)) throw new HostedSourceError('QQ 音乐歌曲 MID 无效')
      const { track_info: track } = await rpc(cookie, 'music.pf_song_detail_svr', 'get_song_detail_yqq', { song_type: 0, song_mid: id, song_id: 0 }, signal)
      if (!track || track.mid !== id) throw new HostedSourceError('QQ 音乐未返回完整歌曲资料')
      const media = track.file?.media_mid || track.mid
      if (!/^[a-z\d]{14}$/i.test(media)) throw new HostedSourceError('QQ 音乐媒体 MID 无效')
      const filenames = [`M800${id}${media}.mp3`, `M500${id}${media}.mp3`, `C400${media}.m4a`]
      const data = await rpc(cookie, 'vkey.GetVkeyServer', 'CgiGetVkey', {
        guid: String(randomInt(1_000_000_000, 2_000_000_000)), uin: cookie ? session(cookie).uin : '0', loginflag: 1, platform: '20',
        songmid: filenames.map(() => id), songtype: filenames.map(() => track.type ?? 0), filename: filenames,
      }, signal)
      const domain = Array.isArray(data.sip) ? data.sip.find((url: unknown) => typeof url === 'string' && /^https?:\/\//.test(url)) : undefined
      for (const filename of filenames) {
        const item = Array.isArray(data.midurlinfo) ? data.midurlinfo.find((entry: { songmid?: string, filename?: string, purl?: string }) => entry.songmid === id && entry.filename === filename && entry.purl) : undefined
        if (!item || !domain) continue
        // Never accept preview filenames or a URL for a different song/quality.
        const url = validateQQMediaUrl(new URL(item.purl, domain).href)
        if (new URL(url).pathname.split('/').pop() !== filename || item.freeTrialInfo || item.trial) throw new HostedSourceError('QQ 音乐仅提供试听或不匹配的音源，无法一起听完整歌曲')
        return { url }
      }
      throw new HostedSourceError(cookie ? 'QQ 音乐房间账号没有完整音源，请确认会员或版权权限' : 'QQ 音乐匿名音源不可用，请绑定账号或确认版权权限')
    },
  }
}
