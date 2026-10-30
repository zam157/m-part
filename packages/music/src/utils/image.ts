import type { ImageOptions, ImageUsage, ProviderName } from '../types/provider'
import { providers } from './providers/index'
import { toHttpsUrl } from './url'

/** Display sizes in CSS pixels. Providers receive the usage as well, so they can tune each scene. */
const imageSizes: Record<ImageUsage, [number, number]> = {
  queue: [40, 40], player: [48, 48], list: [48, 48], card: [480, 270],
  collection: [320, 320], detail: [160, 160], expanded: [480, 480],
  background: [96, 96], 'media-session': [512, 512],
}

export function imageUrl(provider: ProviderName | undefined, url: string | undefined, usage: ImageUsage, density: 1 | 2 = 1): string {
  const original = toHttpsUrl(url)
  if (!original || !provider) return original
  const [width, height] = imageSizes[usage]
  const options: ImageOptions = { usage, width: width * density, height: height * density, fit: 'cover' }
  return providers[provider]?.getImageUrl?.(original, options) || original
}

/** Density descriptors let the browser select sharper thumbnails without serving originals everywhere. */
export function imageSrcSet(provider: ProviderName | undefined, url: string | undefined, usage: ImageUsage) {
  if (!url || usage === 'background') return undefined
  const normal = imageUrl(provider, url, usage)
  const retina = imageUrl(provider, url, usage, 2)
  return normal !== retina ? `${normal.replace(/,/g, '%2C')} 1x, ${retina.replace(/,/g, '%2C')} 2x` : undefined
}
