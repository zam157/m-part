import type { MusicInfo } from '@m-part/music/types/music-info'
import type { LyricsInfo } from '@m-part/music/types/provider'
import type { Accessor } from 'solid-js'
import { errorMessage } from '../utils/index'
import { providers } from '@m-part/music/providers'
import { createEffect, createMemo, createSignal } from 'solid-js'
import { mergeLyrics } from '~/utils/lyrics'

// 仅内存缓存，最多 100 首；不随播放进度访问数据库或重复请求。
const cache = new Map<string, LyricsInfo>()
export function createLyrics(song: Accessor<MusicInfo | null | undefined>, enabled: Accessor<boolean>) {
  const [data, setData] = createSignal<LyricsInfo | null>(null)
  const [loading, setLoading] = createSignal(false)
  const [error, setError] = createSignal<string | null>(null)
  const [revision, setRevision] = createSignal(0)
  const target = createMemo(() => {
    const music = song()
    return music ? { provider: music.provider, id: music.id, lrc: music.lrc } : null
  }, { equals: (a, b) => a?.provider === b?.provider && a?.id === b?.id && a?.lrc === b?.lrc })

  createEffect(() => [enabled(), target(), revision()] as const, ([open, music]) => {
    const controller = new AbortController()
    setLoading(false)
    if (!open) return
    setError(null)
    setData(null)
    if (!music) return
    const key = `${music.provider}:${music.id}`
    const cached = cache.get(key)
    if (music.lrc) { setData({ original: music.lrc }); return }
    if (cached) { setData(cached); return }
    const getLyrics = providers[music.provider].getLyrics
    if (!getLyrics) return
    setLoading(true)
    void (async () => {
      try {
        const result = await getLyrics(music.id, { signal: controller.signal })
        if (controller.signal.aborted) return
        cache.set(key, result)
        if (cache.size > 100) cache.delete(cache.keys().next().value!)
        setData(result)
      }
      catch (cause) {
        if (!controller.signal.aborted) setError(errorMessage(cause))
      }
      finally {
        if (!controller.signal.aborted) setLoading(false)
      }
    })()
    // 切歌、收起和卸载都取消请求；即使 Provider 没响应 abort，也忽略迟到结果。
    return () => controller.abort()
  })
  const lines = createMemo(() => data() ? mergeLyrics(data()!) : [])
  return { data, lines, loading, error, retry: () => setRevision(value => value + 1) }
}
