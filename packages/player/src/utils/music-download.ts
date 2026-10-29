import type { MusicInfo } from '@m-part/music/types/music-info'
import { providers } from '@m-part/music/providers'
import { tRequest } from '@m-part/music/fetch'

const extensions: Record<string, string> = {
  'audio/mpeg': 'mp3', 'audio/mp3': 'mp3', 'audio/mp4': 'm4a', 'video/mp4': 'm4a',
  'audio/aac': 'aac', 'audio/flac': 'flac', 'audio/x-flac': 'flac',
  'audio/ogg': 'ogg', 'application/ogg': 'ogg', 'audio/wav': 'wav', 'audio/x-wav': 'wav',
  'audio/webm': 'webm',
}

/** CDN URLs often end in .m4s or have no suffix; use the actual audio container first. */
export async function audioExtension(blob: Blob, url: string) {
  if (!blob.size) throw new Error('音源返回了空文件')
  const bytes = new Uint8Array(await blob.slice(0, 32).arrayBuffer())
  const text = String.fromCharCode(...bytes)
  if (/^\s*(?:<|\{|\[)/.test(text)) throw new Error('音源返回的不是音频文件')
  if (text.slice(4, 8) === 'ftyp') return 'm4a'
  if (text.startsWith('fLaC')) return 'flac'
  if (text.startsWith('OggS')) return 'ogg'
  if (text.startsWith('RIFF') && text.slice(8, 12) === 'WAVE') return 'wav'
  if (text.startsWith('ID3')) return 'mp3'
  if (bytes[0] === 0xFF && (bytes[1]! & 0xF6) === 0xF0) return 'aac'
  if (bytes[0] === 0xFF && (bytes[1]! & 0xE0) === 0xE0) return 'mp3'
  if (bytes[0] === 0x1A && bytes[1] === 0x45 && bytes[2] === 0xDF && bytes[3] === 0xA3) return 'webm'
  if (/(?:text\/|json|xml)/i.test(blob.type)) throw new Error('音源返回的不是音频文件')
  const mime = extensions[blob.type.split(';')[0]!.trim().toLowerCase()]
  if (mime) return mime
  const suffix = new URL(url).pathname.match(/\.(mp3|m4a|aac|flac|ogg|wav|webm)$/i)?.[1]
  if (suffix) return suffix.toLowerCase()
  throw new Error('无法识别音频格式，请稍后重试')
}

export function musicFilename(music: MusicInfo, extension: string, preview = false) {
  const name = [music.title || music.id, music.artist].filter(Boolean).join(' - ')
    .replace(/[<>:"/\\|?*\u0000-\u001F\u007F]/g, '_').replace(/[. ]+$/g, '').trim().slice(0, 160) || '歌曲'
  return `${name}${preview ? '（试听）' : ''}.${extension}`
}

export function saveMusicBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.append(link)
  try { link.click() }
  catch (error) { URL.revokeObjectURL(url); throw error }
  finally { link.remove() }
  // Let the browser take ownership before releasing the temporary file.
  setTimeout(() => URL.revokeObjectURL(url), 60_000)
}

/** Personal Provider credentials only. Never reuse the player's room media URL or ticket. */
export async function downloadMusicFile(music: MusicInfo, signal: AbortSignal) {
  signal.throwIfAborted()
  const provider = providers[music.provider]
  if (!provider?.getSourceInfo) throw new Error('当前音源不支持下载')
  const source = await provider.getSourceInfo(music)
  signal.throwIfAborted()
  const url = source.qualities?.find(quality => quality.active)?.url || source.qualities?.[0]?.url || source.url
  if (!url || !/^https?:$/.test(new URL(url).protocol)) throw new Error('音源未返回有效的下载地址')
  const response = await tRequest(url, { headers: source.headers, returnJson: false, signal })
  if (!response[0]) throw new Error(`音频下载失败：HTTP ${response[1]}`)
  const range = response[1].headers.get('content-range')
  if (range && !/^bytes 0-(\d+)\/(\d+)$/.test(range)) throw new Error('音源返回了不完整的音频')
  if (range) {
    const [, end, total] = range.match(/^bytes 0-(\d+)\/(\d+)$/)!
    if (Number(end) + 1 !== Number(total)) throw new Error('音源返回了不完整的音频')
  }
  const blob = await response[1].blob()
  const extension = await audioExtension(blob, url)
  signal.throwIfAborted()
  const filename = musicFilename(source.track ?? music, extension, source.availability === 'preview')
  saveMusicBlob(blob, filename)
  return filename
}
