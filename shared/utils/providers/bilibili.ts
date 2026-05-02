import type { MusicInfo } from '#shared/types/music-info'
import type { Provider } from '../../types/provider'
import { MD5 } from 'crypto-es'
import { USE_GM_FETCH, USE_PROXY } from '../constants'
import { tRequest } from '../fetch'

// #region types
export interface BiliResponse<T> {
  code: number
  message?: string
  data: T
}
export interface BuvidInfo {
  b_3: string
  b_4: string
}
export type WbiResponse = BiliResponse<{
  wbi_img: { img_url: string, sub_url: string }
}>
export interface WbiInfo {
  img_key: string
  sub_key: string
}

// #region Search result types
/**
 * 视频搜索结果项
 */
export interface VideoSearchItem {
  /** 搜索结果类型 */
  type: 'video'
  /** 视频ID */
  id: number
  /** 作者名称 */
  author: string
  /** UP主ID */
  mid: number
  /** 分区ID */
  typeid: string
  /** 分区名称 */
  typename: string
  /** 视频链接 */
  arcurl: string
  /** 稿件ID */
  aid: number
  /** B站视频ID */
  bvid: string
  /** 视频标题 */
  title: string
  /** 视频描述 */
  description: string
  /** 排序标记 */
  arcrank: string
  /** 封面图片链接 */
  pic: string
  /** 播放数 */
  play: number
  /** 弹幕数 */
  video_review: number
  /** 收藏数 */
  favorites: number
  /** 标签 */
  tag: string
  /** 评论数 */
  review: number
  /** 发布日期（时间戳） */
  pubdate: number
  /** 发送日期（时间戳） */
  senddate: number
  /** 视频时长 */
  duration: string
  /** 是否为付费视频 */
  badgepay: boolean
  /** 搜索命中的字段 */
  hit_columns: string[]
  /** 视图类型 */
  view_type: string
  /** 是否付费 */
  is_pay: number
  /** 是否为联合视频 */
  is_union_video: number
  /** 推荐标签 */
  rec_tags: null
  /** 新推荐标签 */
  new_rec_tags: unknown[]
  /** 排序分数 */
  rank_score: number
}

/**
 * 用户最近发布的视频信息
 */
export interface UserVideoRes {
  /** 稿件ID */
  aid: number
  /** B站视频ID */
  bvid: string
  /** 视频标题 */
  title: string
  /** 发布日期（时间戳） */
  pubdate: number
  /** 视频链接 */
  arcurl: string
  /** 封面图片链接 */
  pic: string
  /** 播放数 */
  play: string
  /** 弹幕数 */
  dm: number
  /** 投币数 */
  coin: number
  /** 收藏数 */
  fav: number
  /** 视频描述 */
  desc: string
  /** 视频时长 */
  duration: string
  /** 是否付费 */
  is_pay: number
  /** 是否为联合视频 */
  is_union_video: number
}

/**
 * 用户官方认证信息
 */
export interface UserVerifyInfo {
  /** 认证类型 */
  type: number
  /** 认证描述 */
  desc: string
}

/**
 * 哔哩哔哩用户搜索结果项
 */
export interface BiliUserSearchItem {
  /** 搜索结果类型 */
  type: 'bili_user'
  /** 用户ID */
  mid: number
  /** 用户名称 */
  uname: string
  /** 用户签名 */
  usign: string
  /** 粉丝数 */
  fans: number
  /** 视频数 */
  videos: number
  /** 用户头像链接 */
  upic: string
  /** 认证信息 */
  verify_info: string
  /** 用户等级 */
  level: number
  /** 性别 */
  gender: number
  /** 是否为UP主 */
  is_upuser: number
  /** 是否在直播中 */
  is_live: number
  /** 直播间ID */
  room_id: number
  /** 最近发布的视频列表 */
  res: UserVideoRes[]
  /** 官方认证信息 */
  official_verify: UserVerifyInfo
  /** 搜索命中的字段 */
  hit_columns: string[]
}

export type SearchItem = VideoSearchItem | BiliUserSearchItem

/**
 * 搜索接口响应数据
 */
export interface SearchTypeData {
  /** 搜索ID */
  seid: string
  /** 当前页码 */
  page: number
  /** 每页条数 */
  pagesize: number
  /** 总条数（最大1000） */
  numResults: number
  /** 总页数（最大50） */
  numPages: number
  /** 搜索建议关键词 */
  suggest_keyword: string
  /** 请求类型 */
  rqt_type: string
  /** 搜索耗时详情 */
  cost_time: {
    /** 参数检查耗时 */
    params_check: string
    /** 非法处理耗时 */
    illegal_handler: string
    /** 响应格式化耗时 */
    as_response_format: string
    /** 请求耗时 */
    as_request: string
    /** 缓存保存耗时 */
    save_cache: string
    /** 响应反序列化耗时 */
    deserialize_response: string
    /** 请求格式化耗时 */
    as_request_format: string
    /** 总耗时 */
    total: string
    /** 主处理器耗时 */
    main_handler: string
  }
  /** 实验列表 */
  exp_list: Record<string, boolean>
  /** 彩蛋命中标记 */
  egg_hit: number
  /** 副分页信息（仅直播间/主播搜索有效） */
  pageinfo?: Record<string, unknown>
  /** 搜索结果列表 */
  result: SearchItem[]
  /** 显示列标记 */
  show_column: number
}
export interface VideoInfoResponse {
  cid: number
  [key: string]: unknown
}
export interface PlayurlAudioItem {
  baseUrl: string
  id: number
  [key: string]: unknown
}
export interface PlayurlResponse {
  dash: {
    audio: PlayurlAudioItem[]
    [key: string]: unknown
  }
  [key: string]: unknown
}
// #endregion
// #endregion

// #region constants
const API_HOST = USE_PROXY && !USE_GM_FETCH ? '/api/proxy/bili' : 'https://api.bilibili.com'
const DEFAULT_PAGE_SIZE = 20
export const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36'
// #endregion

// #region wbi
const mixinKeyEncTab = [
  46,
  47,
  18,
  2,
  53,
  8,
  23,
  32,
  15,
  50,
  10,
  31,
  58,
  3,
  45,
  35,
  27,
  43,
  5,
  49,
  33,
  9,
  42,
  19,
  29,
  28,
  14,
  39,
  12,
  38,
  41,
  13,
  37,
  48,
  7,
  16,
  24,
  55,
  40,
  61,
  26,
  17,
  0,
  1,
  60,
  51,
  30,
  4,
  22,
  25,
  54,
  21,
  56,
  59,
  6,
  63,
  57,
  62,
  11,
  36,
  20,
  34,
  44,
  52,
]
// 对 imgKey 和 subKey 进行字符顺序打乱编码
function getMixinKey(orig: string) {
  return mixinKeyEncTab
    .map(n => orig[n])
    .join('')
    .slice(0, 32)
}

function generateWbiSignInfo(params: { [key: string]: string | number | object | boolean }, img_key: string, sub_key: string) {
  const mixin_key = getMixinKey(img_key + sub_key)
  const curr_time = Math.round(Date.now() / 1000)
  const chr_filter = /[!'()*]/g

  Object.assign(params, { wts: curr_time }) // 添加 wts 字段
  // 按照 key 重排参数
  const query = Object.keys(params)
    .sort()
    .map((key) => {
      // 过滤 value 中的 "!'()*" 字符
      const value = params[key]!.toString().replace(chr_filter, '')
      return `${encodeURIComponent(key)}=${encodeURIComponent(value)}`
    })
    .join('&')

  const wbi_sign = MD5(query + mixin_key).toString() // 计算 w_rid
  return { w_rid: wbi_sign, wts: curr_time }
}
// 获取最新的 img_key 和 sub_key
async function getWbiKeys(SESSDATA = ''): Promise<WbiInfo> {
  const res = await tRequest<WbiResponse>(`${API_HOST}/x/web-interface/nav`, {
    headers: {
      'cookie': `SESSDATA=${SESSDATA};`,
      'user-agent': USER_AGENT,
      'referer': 'https://www.bilibili.com/',
      'origin': 'https://www.bilibili.com',
    },
  })
  const [ok] = res
  if (!ok)
    throw new Error('Failed to fetch wbi keys')

  const { img_url, sub_url } = res[1].data.wbi_img

  return {
    img_key: img_url.slice(
      img_url.lastIndexOf('/') + 1,
      img_url.lastIndexOf('.'),
    ),
    sub_key: sub_url.slice(
      sub_url.lastIndexOf('/') + 1,
      sub_url.lastIndexOf('.'),
    ),
  }
}
// #endregion

const COMMON_HEADERS = {
  'user-agent': USER_AGENT,
  'accept': '*/*',
  'accept-encoding': 'gzip, deflate, br',
  'accept-language': 'zh-CN,zh;q=0.9,en;q=0.8,en-GB;q=0.7,en-US;q=0.6',
  'origin': 'https://www.bilibili.com',
  'referer': 'https://www.bilibili.com/',
}
// 通用缓存工厂函数
function createAsyncCache<T>(key: string, fetcher: () => Promise<T>) {
  let cache: T | undefined

  if (!import.meta.env.SSR) {
    // 在客户端环境中，直接读取 localStorage 中的缓存
    const cacheStr = localStorage.getItem(key)
    if (cacheStr) {
      cache = JSON.parse(cacheStr)
    }
  }

  let fetchPromise: Promise<T> | undefined

  return async (): Promise<T> => {
    if (fetchPromise) {
      return fetchPromise
    }

    if (!cache) {
      fetchPromise = fetcher()
      try {
        cache = await fetchPromise
        if (!import.meta.env.SSR) {
          localStorage.setItem(key, JSON.stringify(cache))
        }
      }
      finally {
        fetchPromise = undefined
      }
    }

    return cache
  }
}

const getBuvidInfo = createAsyncCache('buvid_info', async () => {
  const res = await tRequest<BiliResponse<BuvidInfo>>(`${API_HOST}/x/frontend/finger/spi`, {
    headers: { 'user-agent': USER_AGENT },
  })
  if (res[0]) {
    return res[1].data
  }
  throw new Error('Failed to fetch buvid info')
})

const getWbiInfo = createAsyncCache('wbi_info', () => getWbiKeys())
async function getCookie() {
  const buvidInfo = await getBuvidInfo()

  return `buvid3=${buvidInfo!.b_3};buvid4=${buvidInfo!.b_4};`
}

async function searchBase(keyword: string, page: number, type: 'video' | 'bili_user') {
  const [cookie, wbiInfoData] = await Promise.all([getCookie(), getWbiInfo()])
  const headers: Record<string, string> = {
    ...COMMON_HEADERS,
    'accept': 'application/json, text/plain, */*',
    'accept-language': 'zh-CN,zh;q=0.9,en;q=0.8,en-GB;q=0.7,en-US;q=0.6',
    cookie,
    'origin': 'https://search.bilibili.com',
    'referer': 'https://search.bilibili.com/',
  }
  const searchParams = {
    search_type: type,
    page,
    page_size: DEFAULT_PAGE_SIZE,
    keyword,
  }
  Object.assign(searchParams, generateWbiSignInfo(searchParams, wbiInfoData!.img_key, wbiInfoData!.sub_key))

  const res = await tRequest<BiliResponse<SearchTypeData>>(`${API_HOST}/x/web-interface/wbi/search/type`, {
    headers,
    searchParams,
  })
  if (!res[0])
    throw new Error(`Search request failed: ${res[2]}`)
  return res[1].data
}

/**
 * 解析时长字符串为秒数
 * 支持格式: "mm:ss" 或 "hh:mm:ss"
 */
function parseDuration(durationStr: string): number {
  const parts = durationStr.split(':').map(Number)
  if (parts.length === 2) {
    return parts[0]! * 60 + parts[1]!
  }
  if (parts.length === 3) {
    return parts[0]! * 3600 + parts[1]! * 60 + parts[2]!
  }
  return 0
}

/**
 * 将搜索结果转换为 MusicInfo 数组
 * 支持视频搜索结果和用户搜索结果
 */
function formateSearchResult(data: SearchTypeData): MusicInfo[] {
  return data.result.flatMap((item) => {
    if (item.type === 'video') {
      return {
        provider: 'bilibili',
        id: item.bvid,
        title: item.title,
        artist: item.author,
        duration: parseDuration(item.duration),
        coverUrl: item.pic,
        album: item.typename,
        qualities: [],
      }
    }
    else if (item.type === 'bili_user') {
      // 用户搜索结果：返回用户最近发布的视频
      return item.res.map(video => ({
        provider: 'bilibili',
        id: video.bvid,
        title: video.title,
        artist: item.uname,
        duration: parseDuration(video.duration),
        coverUrl: video.pic,
        album: item.uname,
        qualities: [],
      }))
    }
    return []
  })
}

async function fetchCid(bvid?: string, aid?: number) {
  if (!bvid && !aid) {
    throw new Error('Either bvid or aid must be provided')
  }
  const res = await tRequest<BiliResponse<VideoInfoResponse>>(`${API_HOST}/x/web-interface/view`, {
    headers: COMMON_HEADERS,
    searchParams: bvid ? { bvid } : { aid },
  })
  if (!res[0]) {
    throw new Error('Failed to fetch video info')
  }
  return res[1].data.cid
}

async function fetchSourceInfo(musicInfo: MusicInfo) {
  const [cid, wbiInfoData] = await Promise.all([fetchCid(musicInfo.id), getWbiInfo()])
  const searchParams = {
    bvid: musicInfo.id,
    cid,
    fnval: 16, // 获取 DASH 格式的播放链接
    from_client: 'BROWSER',
    web_location: 1315873,
    fnver: 0,
  }
  Object.assign(searchParams, generateWbiSignInfo(searchParams, wbiInfoData!.img_key, wbiInfoData!.sub_key))
  const res = await tRequest<BiliResponse<PlayurlResponse>>(`${API_HOST}/x/player/wbi/playurl`, {
    headers: {
      ...COMMON_HEADERS,
      referer: `https://www.bilibili.com/video/${musicInfo.id}`,
    },
    searchParams,
  })
  if (!res[0] || !res[1].data.dash.audio?.[0]) {
    throw new Error('Failed to fetch playurl')
  }
  // 30216 64K
  // 30232 132K
  // 30280 192K
  // 30250 杜比全景声
  // 30251 Hi-Res无损
  // 优先选择 192K 的音频流, 依次降级到 132K 和 64K, 如果都没有则选择第一个可用的音频流
  const audioInfo = (
    res[1].data.dash.audio
      .sort((a, b) => b.id - a.id)
      .find(item => [30280, 30232, 30216].includes(item.id))
  ) || res[1].data.dash.audio[0]
  return {
    url: audioInfo.baseUrl,
    headers: {
      'origin': 'https://www.bilibili.com',
      'referer': `https://www.bilibili.com/video/${musicInfo.id}`,
      'user-agent': USER_AGENT,
    },
  }
}

const biliProvider = {
  name: 'bilibili',
  async search(keyword, page, type) {
    let biliSearchType: 'video' | 'bili_user'
    if (type === 'album' || type === 'music') {
      biliSearchType = 'video'
    }
    else if (type === 'artist') {
      biliSearchType = 'bili_user'
    }
    else {
      throw new Error('Unsupported search type')
    }

    const res = await searchBase(keyword, page, biliSearchType)
    return formateSearchResult(res)
  },
  getSourceInfo: fetchSourceInfo,
} satisfies Provider

export default biliProvider
