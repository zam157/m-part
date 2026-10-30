import { createComponent, render } from '@solidjs/web'
import { createSignal, flush } from 'solid-js'
import { afterEach, expect, it } from 'vitest'
import ProviderImage from '~/components/ProviderImage/ProviderImage'
import type { ProviderName, ImageUsage } from '@m-part/music/types/provider'

let dispose: (() => void) | undefined
afterEach(() => { dispose?.(); document.body.replaceChildren() })
const cover = 'https://i0.hdslb.com/bfs/archive/cover.jpg'

it('forwards native image attributes and reactively resizes when the track or usage changes', () => {
  const [source, setSource] = createSignal<{ provider: ProviderName, src: string, usage: ImageUsage }>({ provider: 'bili', src: cover, usage: 'player' })
  dispose = render(() => createComponent(ProviderImage, {
    get provider() { return source().provider }, get src() { return source().src }, get usage() { return source().usage },
    alt: '封面', class: 'size-12', loading: 'lazy', referrerpolicy: 'no-referrer',
  }), document.body); flush()
  const img = document.querySelector('img')!
  expect(img.getAttribute('src')).toBe(`${cover}@48w_48h_1c.webp`)
  expect(img.getAttribute('srcset')).toContain('@96w_96h_1c.webp 2x')
  expect(img.alt).toBe('封面')
  expect(img.getAttribute('loading')).toBe('lazy')
  expect(img.className).toBe('size-12')
  expect(img.hasAttribute('usage')).toBe(false)
  expect(img.hasAttribute('provider')).toBe(false)
  setSource({ provider: 'netease', src: 'https://p1.music.126.net/cover.jpg', usage: 'detail' }); flush()
  expect(img.getAttribute('src')).toBe('https://p1.music.126.net/cover.jpg?param=160y160')
  expect(img.getAttribute('srcset')).toContain('param=320y320 2x')
})

it('falls back once to the original URL, then resets fallback for a new image', () => {
  const [src, setSrc] = createSignal(cover)
  dispose = render(() => createComponent(ProviderImage, { provider: 'bili', get src() { return src() }, usage: 'queue', alt: '' }), document.body); flush()
  const img = document.querySelector('img')!
  img.dispatchEvent(new Event('error')); flush()
  expect(img.getAttribute('src')).toBe(cover)
  expect(img.hasAttribute('srcset')).toBe(false)
  img.dispatchEvent(new Event('error')); flush()
  expect(img.getAttribute('src')).toBe(cover)
  setSrc(cover.replace('cover', 'next')); flush()
  expect(img.getAttribute('src')).toContain('next.jpg@40w_40h_1c.webp')
  expect(img.getAttribute('srcset')).toContain('next.jpg@80w_80h_1c.webp')
})

it('does not request an empty URL for missing covers', () => {
  dispose = render(() => createComponent(ProviderImage, { provider: 'bili', usage: 'list', alt: '' }), document.body); flush()
  expect(document.querySelector('img')!.hasAttribute('src')).toBe(false)
  expect(document.querySelector('img')!.hasAttribute('srcset')).toBe(false)
})
