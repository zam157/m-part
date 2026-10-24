import type { MusicInfo } from '../../types/music-info'

export interface BiliPage { cid: number, page: number, part: string, duration: number }
export interface BiliVideo {
  bvid?: string, cid?: number, duration?: number, title?: string, pic?: string,
  owner?: { name?: string }, pages?: BiliPage[],
}

/** A CID survives page reordering. Bare BV IDs are legacy first-page entries. */
export function parseBiliTrackId(id: string) {
  const match = /^(BV[a-z\d]{10})(?::([1-9]\d{0,15}))?$/i.exec(id)
  if (!match || (match[2] && !Number.isSafeInteger(Number(match[2])))) throw new Error('BiliBili 视频或分 P 标识无效')
  return { bvid: match[1]!, cid: match[2] ? Number(match[2]) : undefined }
}

export function biliPages(video: BiliVideo): BiliPage[] {
  const pages = video.pages?.length ? video.pages : [{ cid: video.cid, page: 1, part: video.title ?? '', duration: video.duration }]
  if (!Array.isArray(pages) || pages.length > 1000 || !pages.length) throw new Error('BiliBili 分 P 列表无效或超出 1000 P')
  const ids = new Set<number>()
  return pages.map((page) => {
    if (!Number.isSafeInteger(page.cid) || page.cid! <= 0 || ids.has(page.cid!) || !Number.isSafeInteger(page.page) || page.page < 1
      || typeof page.part !== 'string' || !Number.isFinite(page.duration) || page.duration! <= 0 || page.duration! > 86_400) throw new Error('BiliBili 分 P 资料不完整或时长超出限制')
    ids.add(page.cid!)
    return { cid: page.cid!, page: page.page, part: page.part, duration: page.duration! }
  }).sort((a, b) => a.page - b.page)
}

export function selectBiliPage(video: BiliVideo, cid?: number): BiliPage {
  const pages = biliPages(video)
  const page = cid === undefined ? pages[0] : pages.find(page => page.cid === cid)
  if (!page) throw new Error('所选分 P 已不存在或不属于此视频，请重新选择')
  return page
}

export function biliPartTrack(music: MusicInfo, video: BiliVideo, page: BiliPage, count: number): MusicInfo {
  const { bvid } = parseBiliTrackId(music.id)
  const text = (value: string) => value.replace(/<[^>]*>/g, '').replace(/[<>]/g, '')
  const title = text(video.title ?? music.title)
  return {
    provider: 'bili', id: `${bvid}:${page.cid}`,
    title: (count > 1 ? `P${page.page} · ${text(page.part)} — ${title}` : title).slice(0, 300),
    duration: page.duration, coverUrl: music.coverUrl, artist: video.owner?.name ?? music.artist,
    album: music.album, description: music.description,
  }
}
