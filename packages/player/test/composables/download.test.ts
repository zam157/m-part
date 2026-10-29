import { flush } from 'solid-js'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
const { file, parts, selection } = vi.hoisted(() => ({ file: vi.fn(), parts: vi.fn(), selection: vi.fn() }))
vi.mock('~/utils/music-download', () => ({ downloadMusicFile: file }))
vi.mock('~/utils/track-parts', () => ({ needsTrackParts: parts }))
vi.mock('~/composables/track-parts', () => ({ chooseTrackParts: selection, trackParts: () => null, cancelTrackParts: vi.fn() }))
import { cancelDownload, dismissDownloadNotice, downloadMusic, downloadNotice, downloading } from '~/composables/download'
const music = { provider: 'netease' as const, id: '1', title: '歌曲', duration: 120, coverUrl: '' }
beforeEach(() => { file.mockReset().mockResolvedValue('歌曲.mp3'); parts.mockReset().mockReturnValue(false); selection.mockReset(); dismissDownloadNotice(); flush() })
afterEach(() => { cancelDownload(); flush() })

it('ignores repeated clicks while a download is in flight', async () => {
  let resolve!: () => void
  file.mockImplementation(() => new Promise<void>(r => { resolve = r }))
  const pending = downloadMusic(music)
  await downloadMusic({ ...music }); flush()
  expect(downloading()).toBe(true)
  expect(file).toHaveBeenCalledOnce()
  resolve(); await pending; flush()
  expect(downloading()).toBe(false)
  expect(downloadNotice()?.kind).toBe('success')
})
it('resolves selected parts as downloads in source order, not playback operations', async () => {
  const tracks = [{ ...music, id: 'part2' }, { ...music, id: 'part3' }]
  parts.mockReturnValue(true); selection.mockResolvedValue({ action: 'download', tracks })
  await downloadMusic(music); flush()
  expect(selection).toHaveBeenCalledWith(music, 'download')
  expect(file.mock.calls.map(call => call[0])).toEqual(tracks)
  expect(downloadNotice()?.message).toContain('2 个音频文件')
})
it('cancels selection without fetching a default first part', async () => {
  parts.mockReturnValue(true); selection.mockResolvedValue(null)
  await downloadMusic(music); flush()
  expect(file).not.toHaveBeenCalled()
  expect(downloadNotice()).toBeNull()
})
it('reports the failed part for retry without redownloading successful parts', async () => {
  const failed = { ...music, id: 'part2', title: '第二段' }
  parts.mockReturnValue(true); selection.mockResolvedValue({ action: 'download', tracks: [music, failed] })
  file.mockResolvedValueOnce('ok').mockRejectedValueOnce(new Error('HTTP 403'))
  await downloadMusic(music); flush()
  expect(downloadNotice()).toMatchObject({ kind: 'error', music: failed, message: 'HTTP 403' })
  parts.mockReturnValue(false)
  await downloadMusic(downloadNotice()!.music); flush()
  expect(file.mock.calls.map(call => call[0])).toEqual([music, failed, failed])
})
it('aborts an in-flight file request and clears the progress notification', async () => {
  file.mockImplementation((_, signal: AbortSignal) => new Promise((_, reject) => signal.addEventListener('abort', () => reject(signal.reason))))
  const pending = downloadMusic(music); flush()
  cancelDownload(); await pending; flush()
  expect(file.mock.calls[0]![1].aborted).toBe(true)
  expect(downloadNotice()).toBeNull()
  expect(downloading()).toBe(false)
})
