import type { JSX } from '@solidjs/web'
import type { ImageUsage, ProviderName } from '@m-part/music/types/provider'
import { imageSrcSet, imageUrl } from '@m-part/music/image'
import { toHttpsUrl } from '@m-part/music/url'
import { createSignal, omit } from 'solid-js'

type ProviderImageProps = Omit<JSX.ImgHTMLAttributes<HTMLImageElement>, 'src' | 'srcset' | 'sizes' | 'onError'> & {
  provider?: ProviderName
  src?: string
  usage: ImageUsage
}

/** Layout and loading remain native; the Provider owns its CDN syntax. */
export default function ProviderImage(props: ProviderImageProps) {
  const [failed, setFailed] = createSignal<string>()
  const imageProps = omit(props, 'provider', 'src', 'usage')
  const key = () => `${props.provider}:${props.usage}:${props.src}`
  const fallback = () => failed() === key()
  return <img decoding="async" {...imageProps} src={(fallback() ? toHttpsUrl(props.src) : imageUrl(props.provider, props.src, props.usage)) || undefined} srcset={fallback() ? undefined : imageSrcSet(props.provider, props.src, props.usage)} onError={() => setFailed(key())} />
}
