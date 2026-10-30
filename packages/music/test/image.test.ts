import { describe, expect, it } from 'vitest'
import { imageSrcSet, imageUrl } from '../src/utils/image'
import { providers } from '../src/utils/providers/index'
import { biliImageUrl, neteaseImageUrl, qqImageUrl } from '../src/utils/provider-images'
import type { ImageOptions } from '../src/types/provider'

const bili = 'https://i0.hdslb.com/bfs/archive/cover.jpg'
const netease = 'https://p1.music.126.net/hash/123.jpg'
const qq = 'https://y.gtimg.cn/music/photo_new/T002R300x300M000album.jpg'
const options: ImageOptions = { usage: 'list', width: 96, height: 96, fit: 'cover' }

describe('Provider image sizing', () => {
  it('applies Bili CDN processing for each display scene and replaces previous processing once', () => {
    expect(imageUrl('bili', bili, 'queue')).toBe(`${bili}@40w_40h_1c.webp`)
    expect(imageUrl('bili', `${bili}@672w_378h_1c.webp`, 'player', 2)).toBe(`${bili}@96w_96h_1c.webp`)
    expect(imageUrl('bili', bili, 'card')).toBe(`${bili}@480w_270h_1c.webp`)
    expect(imageUrl('bili', bili, 'expanded', 2)).toBe(`${bili}@960w_960h_1c.webp`)
    expect(imageUrl('bili', bili, 'background')).toBe(`${bili}@96w_96h_1c.webp`)
    expect(biliImageUrl(bili, { ...options, fit: 'contain' })).toBe(`${bili}@96w_96h.webp`)
  })
  it('updates Netease dimensions without accumulating params or dropping unrelated query values and hashes', () => {
    const url = `${netease}?param=1000y1000&cache=1#cover`
    expect(imageUrl('netease', url, 'list', 2)).toBe(`${netease}?param=96y96&cache=1#cover`)
    expect(imageUrl('netease', netease, 'detail', 2)).toBe(`${netease}?param=320y320`)
  })
  it('uses QQ thumbnail buckets for album, artist and supported playlist cover paths', () => {
    expect(imageUrl('qq', qq, 'queue')).toContain('T002R90x90M000album.jpg')
    expect(imageUrl('qq', qq, 'list', 2)).toContain('T002R150x150M000album.jpg')
    expect(imageUrl('qq', qq.replace('T002R300x300', 'T001'), 'detail')).toContain('T001R300x300M000album.jpg')
    expect(imageUrl('qq', qq, 'expanded', 2)).toContain('T002R800x800M000album.jpg')
    expect(qqImageUrl('https://qpic.y.qq.com/music_cover/cover/300?n=1', options)).toBe('https://qpic.y.qq.com/music_cover/cover/150?n=1')
  })
  it('supplies 1x/2x candidates only when they differ, avoiding oversized blurred backdrops', () => {
    expect(imageSrcSet('bili', bili, 'list')).toBe(`${bili}@48w_48h_1c.webp 1x, ${bili}@96w_96h_1c.webp 2x`)
    expect(imageSrcSet('qq', qq, 'queue')).toBeUndefined()
    expect(imageSrcSet('bili', bili, 'background')).toBeUndefined()
    expect(imageSrcSet('bili', 'https://other.example/image.jpg', 'list')).toBeUndefined()
  })
  it.each(['https://hdslb.com.evil.example/bfs/a.jpg', 'https://music.126.net.evil.example/a.jpg', 'https://other.example/a.jpg', 'blob:local-image', 'data:image/png;base64,AAAA', '/local-cover.png', 'bad url'])('keeps unsupported locations intact: %s', url => {
    expect(biliImageUrl(url, options)).toBe(url)
    expect(neteaseImageUrl(url, options)).toBe(url)
    expect(qqImageUrl(url, options)).toBe(url)
  })
  it('does not modify signed URLs, unrelated CDN routes or audio URLs', () => {
    expect(imageUrl('bili', `${bili}?token=secret`, 'queue')).toBe(`${bili}?token=secret`)
    expect(imageUrl('netease', `${netease}?signature=secret`, 'queue')).toBe(`${netease}?signature=secret`)
    expect(imageUrl('qq', `${qq}?sign=secret`, 'queue')).toBe(`${qq}?sign=secret`)
    expect(imageUrl('netease', 'https://m1.music.126.net/audio.mp3', 'list')).toBe('https://m1.music.126.net/audio.mp3')
    expect(imageUrl('qq', 'https://y.gtimg.cn/other/a.jpg', 'list')).toBe('https://y.gtimg.cn/other/a.jpg')
  })
  it('normalizes old insecure URLs, handles empty covers and preserves stored metadata', () => {
    expect(imageUrl('bili', '//i0.hdslb.com/bfs/archive/cover.jpg', 'list')).toBe(`${bili}@48w_48h_1c.webp`)
    expect(imageUrl('netease', undefined, 'list')).toBe('')
    expect(imageUrl(undefined, 'http://other.example/a.jpg', 'list')).toBe('https://other.example/a.jpg')
    const track = { coverUrl: bili }
    imageUrl('bili', track.coverUrl, 'queue')
    expect(track.coverUrl).toBe(bili)
  })
  it('passes the scene and physical dimensions to an optional Provider capability', () => {
    const original = providers.bili.getImageUrl
    let received: ImageOptions | undefined
    try {
      providers.bili.getImageUrl = (_, options) => { received = options; return 'https://custom.example/thumb.webp' }
      expect(imageUrl('bili', bili, 'player', 2)).toBe('https://custom.example/thumb.webp')
      expect(received).toEqual({ usage: 'player', width: 96, height: 96, fit: 'cover' })
      providers.bili.getImageUrl = undefined
      expect(imageUrl('bili', bili, 'player')).toBe(bili)
    }
    finally { providers.bili.getImageUrl = original }
  })
})
