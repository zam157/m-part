import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
const { source, request } = vi.hoisted(() => ({ source: vi.fn(), request: vi.fn() }))
vi.mock('@m-part/music/providers', () => ({ providers: { bili: { getSourceInfo: source } } }))
vi.mock('@m-part/music/fetch', () => ({ tRequest: request }))
import { audioExtension, downloadMusicFile, musicFilename, saveMusicBlob } from '~/utils/music-download'

const music = { provider: 'bili' as const, id: 'video:2', title: '第二 P', artist: 'UP 主', duration: 120, coverUrl: '' }
const blob = async (data: string, type = 'application/octet-stream') => new Response(data, { headers: { 'content-type': type } }).blob()
let click: ReturnType<typeof vi.spyOn>
beforeEach(() => {
  vi.useFakeTimers()
  source.mockReset().mockResolvedValue({ qualities: [{ name: '默认', url: 'https://cdn.example/audio.m4s?secret=1' }], headers: { referer: 'https://www.bilibili.com/' } })
  request.mockReset().mockResolvedValue([true, new Response('0000ftypM4A audio', { headers: { 'content-type': 'application/octet-stream' } })])
  vi.stubGlobal('URL', class extends URL { static createObjectURL = vi.fn(() => 'blob:download'); static revokeObjectURL = vi.fn() })
  click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
})
afterEach(() => { vi.runOnlyPendingTimers(); vi.useRealTimers(); vi.restoreAllMocks(); vi.unstubAllGlobals() })

describe('personal music download', () => {
  it('resolves the selected part through its Provider and downloads the true m4a container without changing playback', async () => {
    const controller = new AbortController()
    const filename = await downloadMusicFile(music, controller.signal)
    expect(source).toHaveBeenCalledExactlyOnceWith(music)
    expect(request).toHaveBeenCalledWith('https://cdn.example/audio.m4s?secret=1', { headers: { referer: 'https://www.bilibili.com/' }, returnJson: false, signal: controller.signal })
    expect(filename).toBe('第二 P - UP 主.m4a')
    const link = click.mock.instances[0] as HTMLAnchorElement
    expect(link.download).toBe(filename)
    expect(link.href).toBe('blob:download')
    expect(link.isConnected).toBe(false)
    expect(URL.revokeObjectURL).not.toHaveBeenCalled()
    vi.advanceTimersByTime(60_000)
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:download')
  })
  it('uses canonical metadata, active quality and marks a preview in the filename', async () => {
    source.mockResolvedValue({ track: { ...music, title: '规范标题' }, availability: 'preview', qualities: [{ name: 'a', url: 'https://cdn.example/a.mp3' }, { name: 'b', url: 'https://cdn.example/b.mp3', active: true }] })
    request.mockResolvedValue([true, new Response('ID3audio')])
    expect(await downloadMusicFile(music, new AbortController().signal)).toBe('规范标题 - UP 主（试听）.mp3')
    expect(request.mock.calls[0]![0]).toBe('https://cdn.example/b.mp3')
  })
  it.each(['<html>403 Forbidden</html>', '{"code":403}', ''])('rejects a non-audio response %s', async data => {
    request.mockResolvedValue([true, new Response(data)])
    await expect(downloadMusicFile(music, new AbortController().signal)).rejects.toThrow()
    expect(click).not.toHaveBeenCalled()
  })
  it('does not save a failed or partial response', async () => {
    request.mockResolvedValueOnce([false, 403, 'Forbidden'])
    await expect(downloadMusicFile(music, new AbortController().signal)).rejects.toThrow('HTTP 403')
    request.mockResolvedValueOnce([true, new Response('ID3part', { status: 206, headers: { 'content-range': 'bytes 0-6/100' } })])
    await expect(downloadMusicFile(music, new AbortController().signal)).rejects.toThrow('不完整')
    expect(click).not.toHaveBeenCalled()
  })
  it('does not fetch or save after cancellation while resolving a source', async () => {
    const controller = new AbortController()
    controller.abort()
    await expect(downloadMusicFile(music, controller.signal)).rejects.toThrow()
    expect(request).not.toHaveBeenCalled()
    expect(click).not.toHaveBeenCalled()
  })
  it('cleans up an object URL even when handing off the download fails', async () => {
    click.mockImplementation(() => { throw new Error('blocked') })
    expect(() => saveMusicBlob(new Blob(), 'a.mp3')).toThrow('blocked')
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:download')
    expect(document.querySelector('a[download]')).toBeNull()
  })
  it('sanitizes filenames and detects supported audio independently of CDN suffixes', async () => {
    expect(musicFilename({ ...music, title: 'a/b:*?<>"|', artist: 'x\\y' }, 'flac')).toBe('a_b_______ - x_y.flac')
    expect(await audioExtension(await blob('fLaCdata'), 'https://cdn.example/a.m4s')).toBe('flac')
    expect(await audioExtension(await blob('data', 'audio/mpeg'), 'https://cdn.example/audio')).toBe('mp3')
    expect(await audioExtension(await blob('RIFF0000WAVEdata'), 'https://cdn.example/audio')).toBe('wav')
    await expect(audioExtension(await blob('unknown'), 'https://cdn.example/audio')).rejects.toThrow('无法识别')
  })
})
