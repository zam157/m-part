import type { Provider } from '../../types/provider'
import { tFetch } from '../fetch'

export interface BiliResponse<T> {
  code: number
  message?: string
  data: T
}
export interface BuvidInfo {
  b_3: string
  b_4: string
}

// #region constants
const API_HOST = 'https://api.bilibili.com'
const DEFAULT_PAGE_SIZE = 20
// #endregion

const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36'
const COMMON_HEADERS = {
  'user-agent': USER_AGENT,
  'accept': '*/*',
  'accept-encoding': 'gzip, deflate, br',
  'accept-language': 'zh-CN,zh;q=0.9,en;q=0.8,en-GB;q=0.7,en-US;q=0.6',
}
let buvidInfo: BuvidInfo | undefined
let fetchBuvidInfoPromise: Promise<void> | undefined
async function getCookie() {
  if (fetchBuvidInfoPromise) {
    await fetchBuvidInfoPromise
  }
  else if (!buvidInfo) {
    try {
      const res = await tFetch<BiliResponse<BuvidInfo>>(`${API_HOST}/x/frontend/finger/spi`, {
        headers: { 'user-agent': USER_AGENT },
      })
      if (res[0])
        buvidInfo = res[1].data
      else
        return ''
    }
    catch {
      return ''
    }
  }

  return `buvid3=${buvidInfo!.b_3}; buvid4=${buvidInfo!.b_4}`
}

async function searchBase(keyword: string, page: number, type: 'video' | 'bili_user') {
  const cookie = await getCookie()
  tFetch<BiliResponse<any>>(`${API_HOST}/x/web-interface/search/type`, {
    body: {
      context: '',
      page,
      order: '',
      page_size: DEFAULT_PAGE_SIZE,
      keyword,
      duration: '',
      tids_1: '',
      tids_2: '',
      __refresh__: true,
      _extra: '',
      highlight: 1,
      single_column: 0,
      platform: 'pc',
      from_source: '',
      search_type: type,
      dynamic_offset: 0,
    },
    headers: {
      ...COMMON_HEADERS,
      'accept': 'application/json, text/plain, */*',
      'origin': 'https://search.bilibili.com',
      'sec-fetch-site': 'same-site',
      'sec-fetch-mode': 'cors',
      'sec-fetch-dest': 'empty',
      'referer': 'https://search.bilibili.com/',
      'accept-language': 'zh-CN,zh;q=0.9,en;q=0.8,en-GB;q=0.7,en-US;q=0.6',
      cookie,
    },
  })
}

export const biliProvider: Provider = {
  name: 'bilibili',
  async search(keyword, page, type) {
    if (type === 'album' || type === 'music') {
      return searchBase(keyword, page, 'video')
    }
    else if (type === 'artist') {
      return searchBase(keyword, page, 'bili_user')
    }
  },
}
