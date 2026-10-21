import { flush } from 'solid-js'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { request } = vi.hoisted(() => ({ request: vi.fn() }))
vi.mock('#shared/utils/constants', () => ({ TARGET_EXTENSION: false }))
vi.mock('#shared/utils/fetch', () => ({ tRequest: request }))
vi.mock('#shared/utils/providers', () => ({ providers: {
  bili: { getSourceInfo: async () => ({ url: 'https://cdn.example/audio.m4s', headers: { referer: 'https://www.bilibili.com/' } }) },
} }))

const { audio, resetPlayer, setPlayQueue } = await import('~/composables/player')

describe('非扩展入口兼容', () => {
  beforeEach(() => {
    vi.spyOn(audio, 'pause').mockImplementation(() => {})
    vi.spyOn(audio, 'load').mockImplementation(() => {})
    vi.spyOn(audio, 'play').mockResolvedValue()
    vi.stubGlobal('URL', class extends URL {
      static createObjectURL = vi.fn(() => 'blob:https://localhost/audio')
      static revokeObjectURL = vi.fn()
    })
    request.mockReset().mockResolvedValue([true, { blob: async () => new Blob(['audio']) }])
    resetPlayer()
    flush()
  })
  afterEach(() => {
    resetPlayer()
    flush()
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it('继续通过传输层处理自定义请求头，并回收生成的 Blob URL', async () => {
    await setPlayQueue([{ provider: 'bili', id: '1', title: 'test', duration: 1, coverUrl: '' }])
    flush()
    expect(request).toHaveBeenCalledWith('https://cdn.example/audio.m4s', expect.objectContaining({
      headers: { referer: 'https://www.bilibili.com/' }, returnJson: false,
    }))
    expect(audio.src).toBe('blob:https://localhost/audio')
    resetPlayer()
    flush()
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:https://localhost/audio')
  })
})
