import { afterEach, describe, expect, it, vi } from 'vitest'
import { prepareMedia, startMedia } from '@m-part/listen-core/browser/media'

function media() {
  return Object.assign(new EventTarget(), { readyState: 0, duration: NaN, currentTime: 0, seeking: false, error: null }) as unknown as HTMLAudioElement
}
afterEach(() => vi.useRealTimers())
describe('explicit cancellable media readiness', () => {
  it('does not equate assigning a source or metadata with readiness', async () => {
    const audio = media()
    const controller = new AbortController()
    let done = false
    const result = prepareMedia(audio, 15, controller.signal).then(r => { done = true; return r })
    Object.assign(audio, { readyState: 1, duration: 90 })
    audio.dispatchEvent(new Event('loadedmetadata'))
    expect(audio.currentTime).toBe(15)
    await Promise.resolve()
    expect(done).toBe(false)
    Object.assign(audio, { readyState: 2, seeking: true })
    audio.dispatchEvent(new Event('canplay'))
    await Promise.resolve()
    expect(done).toBe(false)
    Object.assign(audio, { seeking: false })
    audio.dispatchEvent(new Event('seeked'))
    expect(await result).toBe('ready')
  })
  it('resolves stale work on abort without accepting later media events', async () => {
    const audio = media()
    const controller = new AbortController()
    const result = prepareMedia(audio, 0, controller.signal)
    controller.abort()
    Object.assign(audio, { readyState: 4, duration: 90 })
    audio.dispatchEvent(new Event('canplay'))
    expect(await result).toBe('stale')
  })
  it('has a bounded readiness timeout', async () => {
    vi.useFakeTimers()
    const result = prepareMedia(media(), 0, new AbortController().signal, 100)
    const rejection = expect(result).rejects.toThrow('媒体准备超时')
    await vi.advanceTimersByTimeAsync(100)
    await rejection
  })
  it('reports source errors instead of remaining loading', async () => {
    const audio = media()
    const result = prepareMedia(audio, 0, new AbortController().signal)
    Object.assign(audio, { error: { message: 'unavailable' } })
    audio.dispatchEvent(new Event('error'))
    await expect(result).rejects.toThrow('unavailable')
  })
})

it('times out a play promise that never settles instead of leaving the host falsely playing', async () => {
  vi.useFakeTimers()
  const audio = media()
  audio.play = () => new Promise(() => {})
  audio.pause = vi.fn()
  const result = startMedia(audio, new AbortController().signal, 100)
  const rejection = expect(result).rejects.toThrow('播放启动超时')
  await vi.advanceTimersByTimeAsync(100)
  await rejection
  expect(audio.pause).toHaveBeenCalledOnce()
})

it('cancels a pending playback confirmation on a new state', async () => {
  const audio = media()
  audio.play = () => new Promise(() => {})
  const controller = new AbortController()
  const result = startMedia(audio, controller.signal)
  controller.abort()
  expect(await result).toBe('stale')
})
