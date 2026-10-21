import type { AlbumInfo, ArtistInfo, MusicInfo, PlaylistInfo, SourceInfo } from '#shared/types/music-info'
import type { Pagination, Provider } from '#shared/types/provider'
import { tRequest } from '../fetch'
import { toHttpsUrl } from '../url'
import { encryptWeapi } from './netease-crypto'
import { LoginRequiredError } from './login-required'
import { getNeteaseCsrfToken } from './netease-session'

const API_HOST = 'https://music.163.com'
const PAGE_SIZE = 20

interface NeteaseResponse {
  code: number
  message?: string
  msg?: string
}

interface NeteaseArtist {
  id: number
  name: string
  picUrl?: string
  img1v1Url?: string
  briefDesc?: string
  alias?: string[]
}

interface NeteaseAlbum {
  id: number
  name: string
  picUrl?: string
  artist?: NeteaseArtist
  artists?: NeteaseArtist[]
  size?: number
  publishTime?: number
  description?: string
}

interface NeteaseSong {
  id: number
  name: string
  dt?: number
  duration?: number
  ar?: NeteaseArtist[]
  artists?: NeteaseArtist[]
  al?: NeteaseAlbum
  album?: NeteaseAlbum
}

interface SearchResponse extends NeteaseResponse {
  result?: {
    songs?: NeteaseSong[]
    songCount?: number
    artists?: NeteaseArtist[]
    artistCount?: number
    albums?: NeteaseAlbum[]
    albumCount?: number
  }
}

interface RecommendationsResponse extends NeteaseResponse {
  result: { song: NeteaseSong }[]
}

interface NeteasePlaylist {
  id: number
  name: string
  coverImgUrl?: string
  trackCount: number
  description?: string
  creator?: { userId: number, nickname: string }
}

interface AccountResponse extends NeteaseResponse {
  account?: { id: number } | null
  profile?: { userId: number, nickname: string, avatarUrl?: string } | null
}

interface PlaylistsResponse extends NeteaseResponse {
  playlist: NeteasePlaylist[]
  more: boolean
}

interface PlaylistResponse extends NeteaseResponse {
  playlist: { trackIds: { id: number }[] }
}

interface SongsResponse extends NeteaseResponse {
  songs: NeteaseSong[]
}

interface ArtistResponse extends NeteaseResponse {
  artist: NeteaseArtist
}

interface ArtistSongsResponse extends NeteaseResponse {
  songs: NeteaseSong[]
  total: number
}

interface ArtistAlbumsResponse extends NeteaseResponse {
  hotAlbums: NeteaseAlbum[]
  artist: NeteaseArtist & { albumSize?: number }
  more: boolean
}

interface AlbumResponse extends NeteaseResponse {
  album: NeteaseAlbum
  songs: NeteaseSong[]
}

interface SongUrlResponse extends NeteaseResponse {
  data: {
    id: number
    url: string | null
    code: number
    br?: number
    freeTrialInfo?: unknown
  }[]
}

/** 扩展的 cookie 由浏览器携带，Referer/Origin 由 netease DNR 规则设置。 */
async function request<T extends NeteaseResponse>(path: string, data: Record<string, unknown> = {}): Promise<T> {
  const encrypted = encryptWeapi({ ...data, csrf_token: await getNeteaseCsrfToken() })
  const result = await tRequest<T>(`${API_HOST}/weapi${path.slice(4)}`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(encrypted),
  })
  if (!result[0])
    throw new Error(`网易云请求失败：${result[1]} ${result[2]}`)
  if (result[1].code === 301)
    throw new LoginRequiredError(result[1].message || result[1].msg)
  if (result[1].code !== 200)
    throw new Error(result[1].message || result[1].msg || `网易云请求失败（${result[1].code}）`)
  return result[1]
}

function artistNames(artists?: NeteaseArtist[]): string {
  return artists?.map(artist => artist.name).join(' / ') || ''
}

function mapSong(song: NeteaseSong): MusicInfo {
  const album = song.al ?? song.album
  return {
    provider: 'netease',
    id: String(song.id),
    title: song.name,
    artist: artistNames(song.ar ?? song.artists),
    album: album?.name,
    duration: (song.dt ?? song.duration ?? 0) / 1000,
    coverUrl: toHttpsUrl(album?.picUrl),
  }
}

function mapArtist(artist: NeteaseArtist): ArtistInfo {
  return {
    provider: 'netease',
    id: String(artist.id),
    name: artist.name,
    coverUrl: toHttpsUrl(artist.picUrl || artist.img1v1Url),
    description: artist.briefDesc || artist.alias?.join(' / '),
  }
}

function mapAlbum(album: NeteaseAlbum): AlbumInfo {
  const artist = artistNames(album.artists ?? (album.artist ? [album.artist] : []))
  const cover = toHttpsUrl(album.picUrl)
  return {
    provider: 'netease',
    id: String(album.id),
    title: album.name,
    artist,
    coverUrl: cover,
    totalTracks: album.size,
    description: album.description,
    releaseDate: album.publishTime ? new Date(album.publishTime).toISOString() : undefined,
    extra: { title: album.name, artist, cover },
  }
}

function pagination(page: number, total: number): Pagination {
  return { page, pageSize: PAGE_SIZE, total }
}

async function search(keyword: string, page: number, type: 1 | 10 | 100) {
  const response = await request<SearchResponse>('/api/cloudsearch/pc', {
    s: keyword,
    type,
    limit: PAGE_SIZE,
    offset: (page - 1) * PAGE_SIZE,
    total: true,
  })
  return response.result ?? {}
}

const NeteaseProvider: Provider = {
  name: 'netease',
  async getCurrentUser() {
    try {
      const result = await request<AccountResponse>('/api/w/nuser/account/get')
      if (!result.profile || !result.account)
        return null
      return { id: String(result.profile.userId), name: result.profile.nickname, coverUrl: toHttpsUrl(result.profile.avatarUrl) }
    }
    catch (error) {
      if (error instanceof LoginRequiredError)
        return null
      throw error
    }
  },
  async getPlaylists(userId, page) {
    const result = await request<PlaylistsResponse>('/api/user/playlist', {
      uid: userId, offset: (page - 1) * PAGE_SIZE, limit: PAGE_SIZE, includeVideo: true,
    })
    return {
      items: result.playlist.map((item): PlaylistInfo => ({
        provider: 'netease', id: String(item.id), title: item.name, coverUrl: toHttpsUrl(item.coverImgUrl),
        totalTracks: item.trackCount, creator: item.creator?.nickname, description: item.description,
        owned: String(item.creator?.userId) === userId,
      })),
      hasMore: result.more,
    }
  },
  async getPlaylist(id, page) {
    // tracks 可能被服务端截断；用完整 trackIds 分页查询歌曲，保留原歌单顺序。
    const result = await request<PlaylistResponse>('/api/v6/playlist/detail', { id, n: 100000, s: 0 })
    const start = (page - 1) * PAGE_SIZE
    const ids = result.playlist.trackIds.slice(start, start + PAGE_SIZE)
    if (!ids.length)
      return { items: [], hasMore: false }
    const detail = await request<SongsResponse>('/api/v3/song/detail', { c: JSON.stringify(ids.map(item => ({ id: item.id }))) })
    const songs = new Map(detail.songs.map(song => [song.id, song]))
    return {
      items: ids.flatMap(item => songs.has(item.id) ? [mapSong(songs.get(item.id)!)] : []),
      hasMore: start + PAGE_SIZE < result.playlist.trackIds.length,
    }
  },
  async getRecommendations() {
    const result = await request<RecommendationsResponse>('/api/personalized/newsong', {
      type: 'recommend',
      limit: PAGE_SIZE,
      areaId: 0,
    })
    return result.result.map(item => mapSong(item.song))
  },
  async search(keyword, page) {
    const result = await search(keyword, page, 1)
    return [(result.songs ?? []).map(mapSong), pagination(page, result.songCount ?? 0)]
  },
  async searchArtist(keyword, page) {
    const result = await search(keyword, page, 100)
    return [(result.artists ?? []).map(mapArtist), pagination(page, result.artistCount ?? 0)]
  },
  async searchAlbum(keyword, page) {
    const result = await search(keyword, page, 10)
    return [(result.albums ?? []).map(mapAlbum), pagination(page, result.albumCount ?? 0)]
  },
  async getSourceInfo(music): Promise<SourceInfo> {
    const result = await request<SongUrlResponse>('/api/song/enhance/player/url', {
      ids: JSON.stringify([music.id]),
      br: 320000,
    })
    const source = result.data.find(item => String(item.id) === music.id)
    if (!source?.url || source.code !== 200)
      throw new Error('网易云暂未提供可播放音源，可能需要登录、会员或该歌曲暂无版权')
    const url = toHttpsUrl(source.url)
    return {
      url,
      qualities: [{ name: source.freeTrialInfo ? '试听' : source.br ? `${Math.round(source.br / 1000)}K` : '标准', url }],
    }
  },
  async getArtistInfo(id) {
    const result = await request<ArtistResponse>(`/api/v1/artist/${encodeURIComponent(id)}`)
    return mapArtist(result.artist)
  },
  async getArtistWorks(id, page) {
    const result = await request<ArtistSongsResponse>('/api/v1/artist/songs', {
      id,
      private_cloud: 'true',
      work_type: 1,
      order: 'hot',
      limit: PAGE_SIZE,
      offset: (page - 1) * PAGE_SIZE,
    })
    return [result.songs.map(mapSong), pagination(page, result.total)]
  },
  async getArtistAlbums(id, page) {
    const result = await request<ArtistAlbumsResponse>(`/api/artist/albums/${encodeURIComponent(id)}`, {
      limit: PAGE_SIZE,
      offset: (page - 1) * PAGE_SIZE,
      total: true,
    })
    const total = result.artist.albumSize ?? ((page - 1) * PAGE_SIZE + result.hotAlbums.length + (result.more ? 1 : 0))
    return [result.hotAlbums.map(mapAlbum), pagination(page, total)]
  },
  async getAlbumWorks(id, page) {
    const result = await request<AlbumResponse>(`/api/v1/album/${encodeURIComponent(id)}`)
    // 专辑接口一次返回全部歌曲，在 provider 内分页。
    const start = (page - 1) * PAGE_SIZE
    return [result.songs.slice(start, start + PAGE_SIZE).map(song => mapSong({ ...song, al: song.al ?? result.album })), pagination(page, result.songs.length)]
  },
}

export default NeteaseProvider
