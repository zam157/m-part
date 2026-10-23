import { defineHandler } from 'nitro'
import { LAB_TRACK } from '@m-part/listen-core/protocol'

// Original synthetic mono PCM; one short audible pulse per second, no licensed media.
const sampleRate = 8_000
const dataLength = sampleRate * LAB_TRACK.duration * 2
const wav = Buffer.alloc(44 + dataLength)
wav.write('RIFF', 0); wav.writeUInt32LE(wav.length - 8, 4); wav.write('WAVEfmt ', 8)
wav.writeUInt32LE(16, 16); wav.writeUInt16LE(1, 20); wav.writeUInt16LE(1, 22)
wav.writeUInt32LE(sampleRate, 24); wav.writeUInt32LE(sampleRate * 2, 28)
wav.writeUInt16LE(2, 32); wav.writeUInt16LE(16, 34); wav.write('data', 36); wav.writeUInt32LE(dataLength, 40)
for (let i = 0; i < dataLength / 2; i++) {
  const phase = (i % sampleRate) / sampleRate
  const envelope = phase < 0.08 ? Math.sin(Math.PI * phase / 0.08) : 0
  wav.writeInt16LE(Math.round(Math.sin(2 * Math.PI * 440 * i / sampleRate) * envelope * 4_000), 44 + i * 2)
}

export default defineHandler((event) => {
  const headers = { 'Content-Type': 'audio/wav', 'Accept-Ranges': 'bytes', 'Cache-Control': 'public, max-age=3600' }
  const range = event.req.headers.get('range')
  if (!range) return new Response(wav, { headers: { ...headers, 'Content-Length': String(wav.length) } })
  const match = /^bytes=(\d*)-(\d*)$/.exec(range)
  let start = match?.[1] ? Number(match[1]) : 0
  let end = match?.[2] ? Number(match[2]) : wav.length - 1
  if (match && !match[1] && match[2]) { start = Math.max(0, wav.length - Number(match[2])); end = wav.length - 1 }
  if (!match || (!match[1] && !match[2]) || !Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start > end || start >= wav.length) {
    return new Response(null, { status: 416, headers: { ...headers, 'Content-Range': `bytes */${wav.length}` } })
  }
  end = Math.min(end, wav.length - 1)
  return new Response(wav.subarray(start, end + 1), { status: 206, headers: { ...headers, 'Content-Length': String(end - start + 1), 'Content-Range': `bytes ${start}-${end}/${wav.length}` } })
})
