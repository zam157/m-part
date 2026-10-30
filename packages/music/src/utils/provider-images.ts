import type { ImageOptions } from '../types/provider'

function imageLocation(value: string) {
  try {
    const url = new URL(value)
    if (url.protocol !== 'https:' || url.username || url.password) return
    // Avoid invalidating an authenticated CDN URL; ordinary catalogue images are unsigned.
    if ([...url.searchParams.keys()].some(key => /^(?:sign|signature|token|auth_key|wssecret|x-amz-signature)$/i.test(key))) return
    return url
  }
  catch { return }
}

export function biliImageUrl(value: string, options: ImageOptions) {
  const url = imageLocation(value)
  if (!url || !/(^|\.)hdslb\.com$/i.test(url.hostname) || !url.pathname.startsWith('/bfs/') || url.search) return value
  const path = url.pathname.replace(/(\.(?:jpe?g|png|webp|gif|avif))@[^/]*$/i, '$1')
  if (!/\.(?:jpe?g|png|webp|gif|avif)$/i.test(path)) return value
  url.pathname = `${path}@${options.width}w_${options.height}h${options.fit === 'cover' ? '_1c' : ''}.webp`
  return url.href
}

export function neteaseImageUrl(value: string, options: ImageOptions) {
  const url = imageLocation(value)
  if (!url || !/^p\d+\.music\.126\.net$/i.test(url.hostname)) return value
  url.searchParams.set('param', `${options.width}y${options.height}`)
  return url.href
}

export function qqImageUrl(value: string, options: ImageOptions) {
  const url = imageLocation(value)
  if (!url) return value
  // QQ's photo and playlist CDNs expose discrete square thumbnail variants.
  const size = [90, 150, 300, 500, 800].find(size => size >= Math.max(options.width, options.height)) ?? 800
  if (url.hostname === 'y.gtimg.cn' && /^\/music\/photo_new\/T00[12](?:R\d+x\d+)?M000[^/]+\.jpg$/i.test(url.pathname)) {
    url.pathname = url.pathname.replace(/(T00[12])(?:R\d+x\d+)?(M000)/i, `$1R${size}x${size}$2`)
    return url.href
  }
  if ((url.hostname === 'qpic.y.qq.com' || url.hostname === 'p.qpic.cn') && /^\/music_cover\/[^/]+\/\d+$/.test(url.pathname)) {
    url.pathname = url.pathname.replace(/\/\d+$/, `/${size}`)
    return url.href
  }
  return value
}
