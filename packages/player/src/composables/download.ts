import type { MusicInfo } from '@m-part/music/types/music-info'
import { createSignal } from 'solid-js'
import { downloadMusicFile } from '~/utils/music-download'
import { errorMessage } from '~/utils/index'
import { needsTrackParts } from '~/utils/track-parts'
import { cancelTrackParts, chooseTrackParts, trackParts } from './track-parts'

export const [downloadNotice, setDownloadNotice] = createSignal<{
  kind: 'pending' | 'success' | 'error', message: string, music: MusicInfo,
} | null>(null)
export const [downloading, setDownloading] = createSignal(false)
let task: { controller: AbortController, music: MusicInfo } | undefined

export function cancelDownload() {
  task?.controller.abort()
  if (trackParts()?.action === 'download') cancelTrackParts()
  setDownloadNotice(null)
}
export function dismissDownloadNotice() { setDownloadNotice(null) }

export async function downloadMusic(music: MusicInfo) {
  if (task) return
  const current = { controller: new AbortController(), music }
  task = current
  setDownloading(true)
  setDownloadNotice({ kind: 'pending', message: `正在准备「${music.title}」…`, music })
  let failedMusic = music
  try {
    const selection = needsTrackParts(music) ? await chooseTrackParts(music, 'download') : { tracks: [music], action: 'download' }
    if (!selection || current.controller.signal.aborted) { setDownloadNotice(null); return }
    for (let index = 0; index < selection.tracks.length; index++) {
      const track = selection.tracks[index]!
      failedMusic = track
      setDownloadNotice({ kind: 'pending', message: `正在下载 ${index + 1}/${selection.tracks.length}：「${track.title}」…`, music: track })
      await downloadMusicFile(track, current.controller.signal)
    }
    setDownloadNotice({ kind: 'success', message: `已提交 ${selection.tracks.length} 个音频文件，请在浏览器下载列表中查看。`, music })
  }
  catch (error) {
    if (!current.controller.signal.aborted) setDownloadNotice({ kind: 'error', message: errorMessage(error), music: failedMusic })
  }
  finally { task = undefined; setDownloading(false) }
}
