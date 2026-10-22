import type { AlbumInfo, ArtistInfo, MusicInfo, MusicQuality, PlaylistInfo, SourceInfo } from '#shared/types/music-info'
import type { Pagination, Provider } from '#shared/types/provider'
import { tRequest } from '../fetch'
import { toHttpsUrl } from '../url'
import { LoginRequiredError } from './login-required'
import { getQQSession } from './qq-session'
import type { QQSession } from './qq-session'

// 请求结构参考 Rain120/qq-music-api；仅调用官方接口，无 Node.js 运行时依赖。
// 上游 MIT 许可及接口取舍见 docs/qq.md、docs/licenses/qq-music-api.txt。
const CGI = 'https://c.y.qq.com'
const RPC = 'https://u.y.qq.com/cgi-bin/musicu.fcg'
const PAGE_SIZE = 20
const guid = String(1000000000 + Math.floor(Math.random() * 1147483647))

interface QQResponse { code: number, subcode?: number, message?: string, msg?: string }
interface QQArtist { mid: string, name: string }
interface QQAlbum { mid: string, name: string, pmid?: string, time_public?: string }
interface QQSong {
  mid?: string
  songmid?: string
  title?: string
  name?: string
  songname?: string
  singer?: QQArtist[]
  album?: QQAlbum
  albummid?: string
  albumname?: string
  interval?: number
  type?: number
  file?: { media_mid?: string }
}
interface QQPlaylist {
  disstid?: string | number
  dissid?: string | number
  tid?: string | number
  dissname?: string
  diss_name?: string
  title?: string
  imgurl?: string
  logo?: string
  diss_cover?: string
  cover?: string
  song_count?: number
  songnum?: number
  song_cnt?: number
  songnum_private?: number
  introduction?: string
  desc?: string
  creator?: { name?: string }
  nick?: string
}
interface PlaylistDetail extends QQPlaylist {
  songlist: QQSong[]
  song_begin: number
  total_song_num: number
}
interface ArtistDetail {
  singer_info: QQArtist
  singer_brief?: string
  songlist: QQSong[]
  total_song: number
}
interface QQSearchAlbum {
  albumMID: string
  albumName: string
  albumPic?: string
  singerName: string
  publicTime?: string
  song_count?: number
}

function check(response: QQResponse, operation: string) {
  if (response.code === 1000 || response.code === 2000)
    throw new LoginRequiredError('请在当前浏览器登录 QQ 音乐后重试')
  if (response.code !== 0)
    throw new Error(response.message || response.msg || `QQ 音乐${operation}失败（${response.code}）`)
}

async function cgi<T extends QQResponse>(path: string, params: Record<string, string | number>, signal?: AbortSignal, session?: QQSession): Promise<T> {
  signal?.throwIfAborted()
  const login = session ?? await getQQSession()
  signal?.throwIfAborted()
  const result = await tRequest<T>(`${CGI}${path}`, {
    searchParams: { format: 'json', inCharset: 'utf8', outCharset: 'utf-8', platform: 'yqq.json', needNewCode: 0, g_tk: login.token, loginUin: login.uin, ...params },
    signal,
  })
  signal?.throwIfAborted()
  if (!result[0]) throw new Error(`QQ 音乐请求失败：${result[1]} ${result[2]}`)
  check(result[1], '请求')
  return result[1]
}

async function rpc<T>(module: string, method: string, param: Record<string, unknown>, options: { signal?: AbortSignal, pc?: boolean, session?: QQSession } = {}): Promise<T> {
  options.signal?.throwIfAborted()
  const login = options.session ?? await getQQSession()
  options.signal?.throwIfAborted()
  const result = await tRequest<QQResponse & { req_0?: QQResponse & { data: T } }>(RPC, {
    method: 'POST', headers: { 'content-type': 'application/json' }, signal: options.signal,
    body: {
      comm: { ct: options.pc ? 19 : 24, cv: options.pc ? 1859 : 0, uin: login.uin, format: 'json', g_tk: login.token, authst: login.key, auth_tkn: login.token },
      req_0: { module, method, param },
    },
  })
  options.signal?.throwIfAborted()
  if (!result[0]) throw new Error(`QQ 音乐请求失败：${result[1]} ${result[2]}`)
  check(result[1], '请求')
  if (!result[1].req_0) throw new Error('QQ 音乐返回的数据不完整')
  check(result[1].req_0, '请求')
  return result[1].req_0.data
}

const cover = (mid: string | undefined, type: 'album' | 'artist') => mid ? `https://y.gtimg.cn/music/photo_new/${type === 'album' ? 'T002' : 'T001'}R300x300M000${encodeURIComponent(mid)}.jpg` : ''
const artists = (singers?: QQArtist[]) => singers?.map(item => item.name).join(' / ') || ''
const pagination = (page: number, total: number): Pagination => ({ page, pageSize: PAGE_SIZE, total })
function song(item: QQSong): MusicInfo {
  return {
    provider: 'qq', id: item.mid ?? item.songmid ?? '', title: item.title || item.name || item.songname || '未知歌曲',
    artist: artists(item.singer), album: item.album?.name ?? item.albumname, duration: item.interval ?? 0,
    coverUrl: cover(item.album?.pmid || item.album?.mid || item.albummid, 'album') || cover(item.singer?.[0]?.mid, 'artist'),
  }
}
const songs = (items: QQSong[]) => items.map(song).filter(item => item.id)
function playlist(item: QQPlaylist, owned?: boolean): PlaylistInfo {
  return {
    provider: 'qq', id: String(item.disstid || item.tid || item.dissid || ''), title: item.dissname || item.diss_name || item.title || '歌单',
    coverUrl: toHttpsUrl(item.imgurl || item.logo || item.diss_cover || item.cover), totalTracks: item.song_count ?? item.songnum ?? item.song_cnt ?? 0,
    creator: item.creator?.name || item.nick, description: item.introduction || item.desc, ...(owned === undefined ? {} : { owned }),
  }
}

async function playlistPage(id: string, start: number, count: number, signal?: AbortSignal) {
  const result = await cgi<QQResponse & { cdlist?: PlaylistDetail[] }>('/qzone/fcg-bin/fcg_ucc_getcdinfo_byids_cp.fcg', {
    disstid: id, type: 1, json: 1, utf8: 1, onlysong: 0, new_format: 1, song_begin: start, song_num: count,
  }, signal)
  const detail = result.cdlist?.[0]
  if (!detail) throw new Error('QQ 音乐未返回歌单，可能已删除或未公开')
  if (!Array.isArray(detail.songlist)) throw new Error('QQ 音乐返回的歌单曲目不完整')
  return detail
}

async function pcSearch<T>(keyword: string, page: number, type: 1 | 2, key: 'singer' | 'album') {
  const result = await rpc<{ body: Record<'singer' | 'album', { list: T[] }>, meta: { sum: number } }>('music.search.SearchCgiService', 'DoSearchForQQMusicDesktop', {
    query: keyword, page_num: page, num_per_page: PAGE_SIZE, search_type: type,
  }, { pc: true })
  return [(result.body[key]?.list ?? []), pagination(page, result.meta.sum)] as const
}

function decodeLyric(value?: string): string {
  if (!value) return ''
  // 接口返回 base64 UTF-8；浏览器原生解码，不使用 Buffer。
  return new TextDecoder().decode(Uint8Array.from(atob(value), character => character.charCodeAt(0)))
}

const QQProvider: Provider = {
  name: 'qq',
  async search(keyword, page) {
    // 现网 desktop 搜歌会返回 2001；旧 CGI 的歌曲分类仍有效，不传 new_json=1。
    const result = await cgi<QQResponse & { data: { song: { list: QQSong[], totalnum: number } } }>('/soso/fcgi-bin/client_search_cp', {
      w: keyword, p: page, n: PAGE_SIZE, t: 0, ct: 24, qqmusic_ver: 1298, remoteplace: 'txt.yqq.song', aggr: 1, cr: 1, lossless: 0, flag_qc: 0,
    })
    return [songs(result.data.song.list), pagination(page, result.data.song.totalnum)]
  },
  async searchArtist(keyword, page) {
    const [items, pageInfo] = await pcSearch<{ singerMID: string, singerName: string, singerPic?: string }>(keyword, page, 1, 'singer')
    return [items.map((item): ArtistInfo => ({ provider: 'qq', id: item.singerMID, name: item.singerName, coverUrl: toHttpsUrl(item.singerPic) || cover(item.singerMID, 'artist') })), pageInfo]
  },
  async searchAlbum(keyword, page) {
    const [items, pageInfo] = await pcSearch<QQSearchAlbum>(keyword, page, 2, 'album')
    return [items.map((item): AlbumInfo => ({ provider: 'qq', id: item.albumMID, title: item.albumName, artist: item.singerName, coverUrl: toHttpsUrl(item.albumPic) || cover(item.albumMID, 'album'), totalTracks: item.song_count, releaseDate: item.publicTime })), pageInfo]
  },
  async searchPlaylist(keyword, page) {
    const result = await cgi<QQResponse & { data: { list: QQPlaylist[], sum: number } }>('/soso/fcgi-bin/client_music_search_songlist', {
      query: keyword, page_no: page - 1, num_per_page: PAGE_SIZE, remoteplace: 'txt.yqq.playlist', flag_qc: 0,
    })
    return [result.data.list.map(item => playlist(item)), pagination(page, result.data.sum)]
  },
  async getRecommendations() {
    const result = await rpc<{ songlist: QQSong[] }>('newsong.NewSongServer', 'get_new_song_info', { type: 5 })
    return songs(result.songlist.slice(0, PAGE_SIZE))
  },
  async getLyrics(id, options) {
    const result = await cgi<QQResponse & { lyric?: string, trans?: string, retcode?: number }>('/lyric/fcgi-bin/fcg_query_lyric_new.fcg', { songmid: id, pcachetime: Date.now() }, options?.signal)
    if (result.retcode && result.retcode !== 0) throw new Error(`QQ 音乐歌词请求失败（${result.retcode}）`)
    const original = decodeLyric(result.lyric)
    return { original, translated: decodeLyric(result.trans), instrumental: /纯音乐[，,]?\s*请欣赏/.test(original) }
  },
  async getSourceInfo(music): Promise<SourceInfo> {
    const session = await getQQSession()
    const result = await rpc<{ track_info: QQSong }>('music.pf_song_detail_svr', 'get_song_detail_yqq', { song_type: 0, song_mid: music.id, song_id: 0 }, { session })
    const track = result.track_info
    if (!track?.mid || track.mid !== music.id) throw new Error('QQ 音乐未返回目标歌曲资料')
    const media = track.file?.media_mid || track.mid
    const files = [
      { name: '320K', filename: `M800${track.mid}${media}.mp3` },
      { name: '128K', filename: `M500${track.mid}${media}.mp3` },
      { name: 'AAC', filename: `C400${media}.m4a` },
    ]
    const response = await rpc<{ sip: string[], midurlinfo: { songmid: string, filename: string, purl: string }[] }>('vkey.GetVkeyServer', 'CgiGetVkey', {
      guid, uin: session.uin, loginflag: 1, platform: '20', songmid: files.map(() => track.mid), songtype: files.map(() => track.type ?? 0), filename: files.map(item => item.filename),
    }, { session })
    const domain = (response.sip ?? []).map(toHttpsUrl).find(url => /^https:\/\//.test(url))
    const qualities: MusicQuality[] = files.flatMap((file) => {
      const item = response.midurlinfo?.find(item => item.songmid === music.id && item.filename === file.filename && item.purl)
      if (!item || !domain) return []
      const url = new URL(item.purl, domain).toString()
      if (!url.startsWith('https://')) return []
      return [{ name: file.name, url }]
    })
    if (!qualities.length) throw new Error('QQ 音乐暂未提供可播放音源，请登录网页版并确认会员或版权权限')
    return { url: qualities[0]!.url, qualities }
  },
  async getCurrentUser() {
    const session = await getQQSession()
    if (session.uin === '0' || !session.key) return null
    try {
      const result = await cgi<QQResponse & { data: { creator?: { nick?: string, headpic?: string } } }>('/rsc/fcgi-bin/fcg_get_profile_homepage.fcg', {
        cid: 205360838, userid: session.uin, reqfrom: 1, reqtype: 0, hostuin: session.uin,
      }, undefined, session)
      const user = result.data.creator
      if (!user?.nick) throw new Error('QQ 音乐未返回当前账号信息，请刷新登录态后重试')
      return { id: session.uin, name: user.nick, coverUrl: toHttpsUrl(user.headpic) }
    }
    catch (error) {
      if (error instanceof LoginRequiredError) return null
      throw error
    }
  },
  async getPlaylists(userId, page) {
    const start = (page - 1) * PAGE_SIZE
    const session = await getQQSession()
    if (session.uin !== userId || !session.key)
      throw new LoginRequiredError('QQ 音乐账号已变化或未登录，请刷新歌单')
    const [created, collected] = await Promise.all([
      cgi<QQResponse & { data: { disslist: QQPlaylist[], totoal: number } }>('/rsc/fcgi-bin/fcg_user_created_diss', { hostuin: userId, uin: userId, sin: start, size: PAGE_SIZE }, undefined, session),
      // cid 是接口路由 ID，reqtype=3 才是歌单分类；cid=3 会返回 HTTP 200 空正文。
      cgi<QQResponse & { data: { cdlist: QQPlaylist[], totaldiss: number, has_more?: number } }>('/fav/fcgi-bin/fcg_get_profile_order_asset.fcg', { userid: userId, ct: 20, cid: 205360956, reqtype: 3, sin: start, ein: start + PAGE_SIZE - 1 }, undefined, session),
    ])
    if (!Array.isArray(created.data?.disslist) || !Array.isArray(collected.data?.cdlist))
      throw new Error('QQ 音乐未返回收藏歌单数据，请刷新登录态后重试')
    const owned = created.data.disslist.map(item => playlist(item, true)).filter(item => item.id && item.id !== '0')
    const favorites = collected.data.cdlist.map(item => playlist(item, false)).filter(item => item.id && item.id !== '0')
    const items = [...new Map([...favorites, ...owned].map(item => [item.id, item])).values()]
    // totoal 是官方返回的拼写；按原始条目计数，不能用过滤系统目录后的数量计算分页。
    const moreCreated = start + created.data.disslist.length < created.data.totoal
    const moreCollected = collected.data.has_more === undefined
      ? start + collected.data.cdlist.length < collected.data.totaldiss
      : collected.data.has_more === 1
    return { items, hasMore: moreCreated || moreCollected }
  },
  async getPlaylist(id, page) {
    const start = (page - 1) * PAGE_SIZE
    const detail = await playlistPage(id, start, PAGE_SIZE)
    return { items: songs(detail.songlist), hasMore: start + detail.songlist.length < detail.total_song_num }
  },
  async getAllPlaylistTracks(id, options = {}) {
    const items = new Map<string, MusicInfo>()
    let start = 0
    let total = Infinity
    while (start < total) {
      options.signal?.throwIfAborted()
      const detail = await playlistPage(id, start, 1000, options.signal)
      if (detail.song_begin !== start || !detail.songlist.length && start < detail.total_song_num)
        throw new Error('QQ 音乐歌单分页不完整，请重试')
      total = detail.total_song_num
      for (const item of songs(detail.songlist)) items.set(item.id, item)
      start += detail.songlist.length
      options.onProgress?.({ items: [...items.values()], total })
      if (!detail.songlist.length) break
    }
    return [...items.values()]
  },
  async getArtistInfo(id) {
    const result = await rpc<ArtistDetail>('music.web_singer_info_svr', 'get_singer_detail_info', { singermid: String(id), sort: 5, sin: 0, num: 1 })
    return { provider: 'qq', id: result.singer_info.mid, name: result.singer_info.name, coverUrl: cover(result.singer_info.mid, 'artist'), description: result.singer_brief }
  },
  async getArtistWorks(id, page) {
    const result = await rpc<ArtistDetail>('music.web_singer_info_svr', 'get_singer_detail_info', { singermid: String(id), sort: 5, sin: (page - 1) * PAGE_SIZE, num: PAGE_SIZE })
    return [songs(result.songlist), pagination(page, result.total_song)]
  },
  async getArtistAlbums(id, page) {
    const result = await rpc<{ total: number, albumList: { albumMid: string, albumName: string, singerName: string, publishDate?: string, totalNum?: number }[] }>('music.musichallAlbum.AlbumListServer', 'GetAlbumList', { singermid: String(id), order: 0, begin: (page - 1) * PAGE_SIZE, num: PAGE_SIZE })
    return [result.albumList.map((item): AlbumInfo => ({ provider: 'qq', id: item.albumMid, title: item.albumName, artist: item.singerName, coverUrl: cover(item.albumMid, 'album'), releaseDate: item.publishDate, totalTracks: item.totalNum })), pagination(page, result.total)]
  },
  async getAlbumWorks(id, page) {
    const result = await rpc<{ totalNum: number, songList: { songInfo: QQSong }[] }>('music.musichallAlbum.AlbumSongList', 'GetAlbumSongList', { albumMid: String(id), begin: (page - 1) * PAGE_SIZE, num: PAGE_SIZE, order: 2 })
    return [songs(result.songList.map(item => item.songInfo)), pagination(page, result.totalNum)]
  },
}
export default QQProvider
