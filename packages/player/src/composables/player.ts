import type { MusicInfo, MusicQuality, SourceInfo } from '@m-part/music/types/music-info'
import type { ProviderName } from '@m-part/music/types/provider'
import { TARGET_EXTENSION } from '@m-part/music/constants'
import { tRequest } from '@m-part/music/fetch'
import { errorMessage } from '../utils/index'
import { providers } from '@m-part/music/providers'
import { createMemo, createRoot, createSignal } from 'solid-js'
import type { PlayerCache } from '~/utils/player-storage'
import { canControlRoom, dispatchRoomPlayer, isRoomPlayer, playerContextVersion } from './player-context'
import { chooseBiliParts } from './bili-parts'
import type { PartAction } from './bili-parts'
import { parseBiliTrackId } from '@m-part/music/providers/bilibili-parts'

// #region types
export type PlayMode = 'order' | 'loop' | 'random' | 'single-loop'
// #endregion

let abortController: AbortController | null = null
let sourceRevision = 0
let objectUrl: string | null = null
let playIntent = 0
let roomMedia = false
let restoredPlayback: { provider: ProviderName, id: string, time: number } | null = null
let restoredSeek: { revision: number, time: number } | null = null

// #region states
/** 全局共享的 audio 元素 */
export const audio = new Audio()
audio.preload = 'auto'

const [playing, setPlayingState] = createSignal(false)
const [duration, setDuration] = createSignal(0)
const [currentTime, setCurrentTimeState] = createSignal(0)
const [volume, setVolumeState] = createSignal(1)
const [seeking, setSeekingState] = createSignal(false)
const [waiting, setWaiting] = createSignal(false)
const [playbackError, setPlaybackError] = createSignal<string | null>(null)
const [currentIndex, setCurrentIndexState] = createSignal<number | null>(null)
const [showPlayQueue, setShowPlayQueue] = createSignal(false)
const [playMode, setPlayModeState] = createSignal<PlayMode>('order')
const [playQueue, setPlayQueueState] = createSignal<MusicInfo[]>([])
const [randomPlayQueue, setRandomPlayQueueState] = createSignal<number[] | null>(null)
const [currentSourceInfo, setCurrentSourceInfo] = createSignal<SourceInfo | null>(null)

export {
  currentIndex,
  currentSourceInfo,
  currentTime,
  duration,
  playQueue,
  playing,
  playbackError,
  playMode,
  randomPlayQueue,
  seeking,
  setShowPlayQueue,
  setWaiting,
  showPlayQueue,
  volume,
  waiting,
}
// #endregion

// #region getters
/**
 * 派生状态统一放在 createRoot 内创建，避免 Solid 在开发模式下
 * 提示「computation created outside a createRoot will never be disposed」。
 * 这是模块级单例，生命周期与应用一致，root 永不 dispose。
 */
const { currentSong, progress, randomIndex } = createRoot(() => {
  /**
   * 当前进度（0-1）
   */
  const progress = createMemo(() => duration() === 0 ? 0 : currentTime() / duration())

  const currentSong = createMemo(() => {
    const index = currentIndex()
    if (index === null)
      return null
    return playQueue()[index]
  })

  /** 当前歌曲在随机播放列表中的位置 */
  const randomIndex = createMemo(() => {
    const index = currentIndex()
    const random = randomPlayQueue()
    if (index === null || !random?.length || !playQueue().length || playMode() !== 'random')
      return null
    return random.findIndex(i => i === index)
  })

  return { currentSong, progress, randomIndex }
})

export { currentSong, progress, randomIndex }
// #endregion

// #region initialize listeners
audio.addEventListener('play', () => {
  setPlayingState(true)
})
audio.addEventListener('playing', () => {
  setWaiting(false)
  setPlayingState(true)
})
audio.addEventListener('pause', () => {
  setPlayingState(false)
  if (audio.getAttribute('src') && !restoredPlayback && !restoredSeek)
    setCurrentTimeState(audio.currentTime)
})
audio.addEventListener('durationchange', () => {
  setDuration(audio.duration)
})
audio.addEventListener('waiting', () => {
  setWaiting(true)
})
audio.addEventListener('loadstart', () => {
  setWaiting(true)
})
audio.addEventListener('loadeddata', () => {
  setWaiting(false)
})
audio.addEventListener('loadedmetadata', applyRestoredSeek)
audio.addEventListener('timeupdate', () => {
  // 恢复时加载源会先发出旧位置 0 的事件，元数据就绪前保留缓存进度。
  if (!restoredPlayback && !restoredSeek)
    setCurrentTimeState(audio.currentTime)
})
audio.addEventListener('seeking', () => {
  setSeekingState(true)
})
audio.addEventListener('seeked', () => {
  setSeekingState(false)
})
audio.addEventListener('volumechange', () => {
  setVolumeState(audio.volume)
})
audio.addEventListener('ended', () => {
  if (dispatchRoomPlayer({ type: 'ended' })) return
  if (playMode() === 'single-loop') {
    // 单曲循环：重新播放当前歌曲
    setCurrentTime(0)
    setPlaying(true)
    return
  }
  if (playMode() === 'order') {
    // 顺序播放：如果是最后一首，停止播放
    if (currentIndex() === playQueue().length - 1) {
      setPlaying(false)
      prevNext(1, false)
      return
    }
  }
  prevNext(1)
})
audio.addEventListener('error', (e) => {
  console.error('Audio error:', e)
  setPlaybackError(audio.error?.message || '音频加载失败，请重试或切换音源')
  setWaiting(false)
  setPlayingState(false)
  setSeekingState(false)
})
// #endregion

// #region actions
/** 关闭通知仅清除文案，不改变当前歌曲、播放状态或队列。 */
export function dismissPlaybackError() {
  setPlaybackError(null)
}

/**
 * 生成随机播放顺序（Fisher-Yates 洗牌算法）。
 *
 * 注意：Solid 2 的 signal 写入会在下一次 flush 才提交，写入后立刻读取拿到的是
 * 提交前的值。因此这里做成不读取响应式状态的纯函数，由调用方把长度传进来。
 */
function createRandomOrder(length: number): number[] | null {
  if (length === 0)
    return null
  const indices = Array.from({ length }, (_, i) => i)
  for (let i = indices.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[indices[i], indices[j]] = [indices[j]!, indices[i]!]
  }
  return indices
}

export function resetPlayer() {
  playIntent++
  restoredPlayback = null
  restoredSeek = null
  void playSource(undefined, null)
  setCurrentIndexState(null)
  setCurrentTimeState(0)
  setDuration(0)
  setPlayingState(false)
  setWaiting(false)
  setSeekingState(false)
  setRandomPlayQueueState(null)
}

/**
 * 拉取并加载指定音质的音频。
 *
 * `sourceInfo` 由调用方显式传入：Solid 2 的 signal 写入要到下一次 flush 才提交，
 * 刚写完 `setCurrentSourceInfo` 就读取会拿到旧值（null），那样这里会直接提前返回，
 * 表现为「点了歌、接口也正常返回，但没有声音」。UI 侧的入口见 `changeQuality`。
 */
async function loadQuality(sourceInfo: SourceInfo, quality?: MusicQuality) {
  const revision = sourceRevision
  const { qualities, headers, url } = sourceInfo
  setPlaybackError(null)

  roomMedia = false
  audio.removeAttribute('crossorigin')
  const targetUrl = quality?.url || url
  if (quality && qualities) {
    // 用不可变更新替换就地改写 qualities[].active，保证 Solid 能感知变化
    setCurrentSourceInfo({
      ...sourceInfo,
      qualities: qualities.map(q => ({ ...q, active: q.name === quality.name })),
    })
  }

  if (!targetUrl)
    throw new Error('No valid URL found in qualities.')

  if (TARGET_EXTENSION) {
    // CDN 的 Referer 等头由 DNR 的 media 规则注入，Cookie 由浏览器管理。
    // 不设 crossOrigin：保留媒体元素默认的凭据行为，不额外要求 CDN 支持 CORS。
    // 原生媒体加载可在下载完成前播放，并由浏览器处理缓冲、Range 与拖动进度。
    audio.src = targetUrl
    audio.load()
    return
  }

  // 非扩展模式保留传输层，兼容需要自定义 headers / GM fetch 的旧入口。
  if (!abortController)
    abortController = new AbortController()
  const res = await tRequest(targetUrl, { headers, returnJson: false, signal: abortController.signal })
  if (!res[0])
    throw new Error(`Failed to fetch source URL: ${res[2]}`)

  const blob = await res[1].blob()
  if (revision !== sourceRevision) return
  if (objectUrl)
    URL.revokeObjectURL(objectUrl)
  objectUrl = URL.createObjectURL(blob)
  audio.src = objectUrl
  audio.load()
}

/**
 * 改变音质（UI 入口）。
 *
 * 这里读 `currentSourceInfo()` 是安全的：调用方在事件回调里调用，
 * 此前 `setCurrentSourceInfo` 的写入早已提交。
 */
export async function changeQuality(quality?: MusicQuality) {
  if (quality && dispatchRoomPlayer({ type: 'quality', quality })) return
  const sourceInfo = currentSourceInfo()
  if (!sourceInfo)
    return
  await loadQuality(sourceInfo, quality)
}

/**
 * 设置播放地址的内部实现。
 *
 * `music` 由调用方显式传入：Solid 2 的 signal 写入要到下一次 flush 才提交，
 * 若在这里读取 `currentSong()`，刚由 `startPlaying` 写入的 `currentIndex`
 * 还不可见，会拿到上一首歌（或 null）。
 */
async function playSource(music: MusicInfo | undefined, src: string | null, provider?: ProviderName) {
  const revision = ++sourceRevision
  restoredSeek = null
  setPlaybackError(null)
  setCurrentSourceInfo(null)
  if (abortController) {
    abortController.abort()
    abortController = null
  }
  // 切歌或清空队列时立即中止旧媒体下载与播放。
  audio.pause()
  audio.removeAttribute('src')
  audio.load()
  if (objectUrl) {
    URL.revokeObjectURL(objectUrl)
    objectUrl = null
  }
  if (src) {
    audio.src = src
    audio.load()
    prepareRestoredSeek(music, revision)
    return
  }
  if (provider) {
    // 使用 provider 提供的 getSourceInfo 方法获取带有必要 headers 的播放地址
    // 以便在需要跨域请求时能够正常播放
    const providerInstance = providers[provider]
    if (providerInstance?.getSourceInfo && music) {
      try {
        setWaiting(true)
        const sourceInfo = await providerInstance.getSourceInfo(music)
        if (revision !== sourceRevision)
          return
        setCurrentSourceInfo(sourceInfo)
        if (sourceInfo.track && !isRoomPlayer()) {
          setPlayQueueState(items => items.map(item => item.provider === music.provider && item.id === music.id ? sourceInfo.track! : item))
        }
        // TODO: 记住上次使用的音质，优先选择上次使用的音质, 目前先默认选择第一个音质
        const defaultQuality = sourceInfo.qualities?.[0]
        // 显式传 sourceInfo，不在这里读 signal（写入尚未提交，读到的还是 null）
        await loadQuality(sourceInfo, defaultQuality)
        if (revision === sourceRevision)
          prepareRestoredSeek(music, revision)
      }
      catch (error) {
        if (revision !== sourceRevision)
          return
        console.error(`Error fetching source info from provider ${provider}:`, error)
        setPlaybackError(errorMessage(error))
        audio.pause()
        audio.removeAttribute('src')
        audio.load()
        setPlayingState(false)
        setWaiting(false)
      }
      finally {
        if (revision === sourceRevision)
          abortController = null
      }
      return
    }

    console.warn(`Provider ${provider} does not support getSourceInfo or current song is null.`)
  }

  audio.removeAttribute('src')
}

/**
 * 设置播放地址（以当前播放的歌曲为准）
 */
export async function setSrc(src: string | null, provider?: ProviderName) {
  if (dispatchRoomPlayer({ type: 'retry' })) return
  await playSource(currentSong() ?? undefined, src, provider)
}
/**
 * 设置播放状态
 */
export async function setPlaying(isPlaying: boolean) {
  if (dispatchRoomPlayer({ type: 'play', playing: isPlaying })) return
  const intent = ++playIntent
  if (isPlaying) {
    if (restoredPlayback && !audio.getAttribute('src')) {
      const music = currentSong() ?? undefined
      const revision = sourceRevision + 1
      await playSource(music, music?.src || null, music?.provider)
      if (intent !== playIntent || revision !== sourceRevision)
        return
    }
    // 音源请求失败后，调用方仍可能尝试自动播放；不能重播上一首残留的媒体。
    if (!audio.getAttribute('src')) {
      setPlayingState(false)
      return
    }
    try {
      await audio.play()
    }
    catch (err) {
      // 换歌、切音质或暂停会中断尚未完成的 play()，这不是播放故障。
      if (err instanceof DOMException && err.name === 'AbortError')
        return
      console.error('Failed to play audio:', err)
      setPlaybackError(errorMessage(err))
      setPlayingState(false)
      setSeekingState(false)
      setWaiting(false)
      audio.pause()
    }
  }
  else {
    audio.pause()
  }
}
/**
 * 切换到指定歌曲。
 *
 * `music` 由调用方显式传入（而不是内部读取 `playQueue()`），这样在同一个同步块里
 * 刚写入过播放列表的调用方也能正确取到歌曲 —— Solid 2 的 signal 写入要到下一次
 * flush 才提交，写入后立刻读取会拿到旧列表。
 */
async function startPlaying(music: MusicInfo | undefined, index: number) {
  playIntent++
  restoredPlayback = null
  restoredSeek = null
  setCurrentIndexState(index)
  setCurrentTimeState(0)
  setDuration(0)
  await playSource(music, music?.src || null, music?.provider)
}

/**
 * 设置当前播放的歌曲
 */
export async function setCurrentIndex(index: number) {
  if (dispatchRoomPlayer({ type: 'select', index })) return
  await startPlaying(playQueue()[index], index)
}

/**
 * 播放上一首或下一首
 * @param type 0: prev, 1: next
 * @param autoPlay 是否自动播放下一首，默认为 true
 */
export async function prevNext(type: 0 | 1, autoPlay = true) {
  if (dispatchRoomPlayer({ type: 'next', direction: type })) return
  const list = playQueue()
  if (!list.length)
    return

  const current = currentIndex()
  if (current === null || list.length <= 0)
    return

  const mode = playMode()
  // order
  if (mode === 'order') {
    const nextIndex = type === 0 ? current - 1 : current + 1
    if (nextIndex < 0) {
      await setCurrentIndex(list.length - 1)
    }
    else if (nextIndex >= list.length) {
      await setPlaying(false)
      await setCurrentIndex(0)
    }
    else {
      await setCurrentIndex(nextIndex)
    }
  }
  // loop
  else if (mode === 'loop') {
    const nextIndex = type === 0 ? current - 1 : current + 1
    await setCurrentIndex((nextIndex + list.length) % list.length)
  }
  // single-loop
  else if (mode === 'single-loop') {
    const nextIndex = type === 0 ? current - 1 : current + 1
    await setCurrentIndex((nextIndex + list.length) % list.length)
  }
  // random
  else if (mode === 'random') {
    const random = randomPlayQueue()
    const position = randomIndex()
    if (position === null || !random) {
      await setPlaying(false)
      return
    }

    let nextRandomIndex = type === 0 ? position - 1 : position + 1
    nextRandomIndex = (nextRandomIndex + random.length) % random.length
    await setCurrentIndex(random[nextRandomIndex]!)
  }
  if (autoPlay)
    await setPlaying(true)
}

/**
 * 设置当前时间
 */
export function setCurrentTime(time: number) {
  if (dispatchRoomPlayer({ type: 'seek', position: time })) return
  setCurrentTimeState(time)
  if (restoredPlayback) {
    restoredPlayback.time = time
    return
  }
  if (restoredSeek && audio.readyState < 1) {
    restoredSeek.time = time
    return
  }
  audio.currentTime = time
}

/**
 * 设置音量
 */
export function setVolume(vol: number) {
  audio.volume = vol
  setVolumeState(vol)
}

/** 启动时恢复资料和进度，保持暂停；首次点击播放才获取新的音频地址。 */
export function restorePlayerSession(cache: PlayerCache) {
  if (cache.volume !== undefined)
    setVolume(cache.volume)
  if (!cache.queue)
    return
  resetPlayer()
  const { items, playMode: mode, randomOrder } = cache.queue
  const saved = cache.position
  const found = saved?.song ? items.findIndex(song => song.provider === saved.song!.provider && song.id === saved.song!.id) : -1
  const index = found >= 0 ? found : items.length ? 0 : null
  const music = index === null ? undefined : items[index]
  const time = found >= 0 ? saved?.time ?? 0 : 0
  setPlayQueueState(items)
  setPlayModeState(mode)
  setRandomPlayQueueState(mode === 'random' ? randomOrder ?? createRandomOrder(items.length) : null)
  setCurrentIndexState(index)
  setCurrentTimeState(time)
  setDuration(music?.duration ?? 0)
  if (music)
    restoredPlayback = { provider: music.provider, id: music.id, time }
}

function prepareRestoredSeek(music: MusicInfo | undefined, revision: number) {
  const saved = restoredPlayback
  if (!saved || !music || saved.provider !== music.provider || saved.id !== music.id)
    return
  restoredPlayback = null
  restoredSeek = { revision, time: saved.time }
  setCurrentTimeState(saved.time)
  if (audio.readyState >= 1)
    applyRestoredSeek()
}

function applyRestoredSeek() {
  if (!restoredSeek || restoredSeek.revision !== sourceRevision)
    return
  const saved = restoredSeek
  restoredSeek = null
  const time = Number.isFinite(audio.duration) ? Math.min(saved.time, Math.max(0, audio.duration - 0.05)) : saved.time
  audio.currentTime = time
  setCurrentTimeState(time)
}

/**
 * 覆盖播放列表
 */
export async function setPlayQueue(newPlayQueue: MusicInfo[]) {
  if (dispatchRoomPlayer({ type: 'queue', tracks: newPlayQueue })) return
  resetPlayer()
  setPlayQueueState(newPlayQueue)
  if (playMode() === 'random') {
    const random = createRandomOrder(newPlayQueue.length)
    setRandomPlayQueueState(random)
    setCurrentIndexState(random?.[0] ?? null)
  }
  await startPlaying(newPlayQueue[0], 0)
  await setPlaying(newPlayQueue.length > 0)
}

/**
 * 添加到播放列表
 */
export async function addToPlayQueue(item: MusicInfo) {
  if (item.provider === 'bili' && !item.id.includes(':') && providers.bili?.getTrackParts && await selectPartsIfNeeded(item, 'play')) return
  if (dispatchRoomPlayer({ type: 'append', track: item })) return
  // 避免重复添加同一首歌
  const list = playQueue()
  const existingIndex = list.findIndex(m => m.provider === item.provider && m.id === item.id)
  if (existingIndex !== -1) {
    await setCurrentIndex(existingIndex)
    await setPlaying(true)
    return
  }

  setPlayQueueState([...list, item])
  if (playMode() === 'random') {
    const random = randomPlayQueue() ?? []
    // 随机插入新歌曲在随机列表中的位置
    const insertPos = Math.floor(Math.random() * (random.length + 1))
    setRandomPlayQueueState([
      ...random.slice(0, insertPos),
      list.length,
      ...random.slice(insertPos),
    ])
  }
  await startPlaying(item, list.length)
  await setPlaying(true)
}

/** 将歌曲放到当前曲目之后，保留当前播放；空队列直接播放。 */
export async function addNextToPlayQueue(item: MusicInfo) {
  if (item.provider === 'bili' && !item.id.includes(':') && providers.bili?.getTrackParts && await selectPartsIfNeeded(item, 'next')) return
  if (dispatchRoomPlayer({ type: 'add-next', track: item })) return
  const list = playQueue()
  const current = currentIndex()
  if (current === null || !list[current]) {
    await addToPlayQueue(item)
    return
  }
  const sameSong = (song: MusicInfo) => song.provider === item.provider && song.id === item.id
  if (sameSong(list[current]!))
    return

  const existing = list.find(sameSong)
  const remaining = list.map((song, index) => ({ song, index })).filter(entry => !sameSong(entry.song))
  const nextCurrent = remaining.findIndex(entry => entry.index === current)
  const insertAt = nextCurrent + 1
  const nextQueue = remaining.map(entry => entry.song)
  nextQueue.splice(insertAt, 0, existing ?? item)
  setPlayQueueState(nextQueue)
  setCurrentIndexState(nextCurrent)

  if (playMode() === 'random') {
    // 队列重排后重映射索引，并在实际随机播放顺序里同样放到下一首。
    const indexMap = new Map(remaining.map((entry, index) => [entry.index, index >= insertAt ? index + 1 : index]))
    const random = randomPlayQueue() ?? createRandomOrder(list.length) ?? []
    const order = random.flatMap(index => indexMap.has(index) ? [indexMap.get(index)!] : [])
    order.splice(order.indexOf(nextCurrent) + 1, 0, insertAt)
    setRandomPlayQueueState(order)
  }
}

/** All part entry points resolve before dispatching either local or room operations. */
async function selectPartsIfNeeded(item: MusicInfo, action: PartAction, force = false) {
  if (item.provider !== 'bili') return false
  try { if (!force && parseBiliTrackId(item.id).cid !== undefined) return false } catch { return false }
  if (!canControlRoom()) return true
  const scope = playerContextVersion()
  const selection = await chooseBiliParts(item, action, force)
  if (selection && scope === playerContextVersion() && canControlRoom()) await addTracksToPlayQueue(selection.tracks, selection.action)
  return true
}
export async function openBiliParts(item: MusicInfo) { await selectPartsIfNeeded(item, 'play', true) }

export async function addTracksToPlayQueue(items: MusicInfo[], action: PartAction) {
  if (!items.length || !canControlRoom()) return
  if (dispatchRoomPlayer({ type: 'append-many', tracks: items, placement: action === 'next' ? 'next' : 'end', autoplay: action === 'play' })) return
  const original = playQueue()
  const current = currentIndex() === null ? undefined : original[currentIndex()!]
  const seen = new Set<string>()
  const selected = items.filter(item => { const key = `${item.provider}:${item.id}`; if (seen.has(key)) return false; seen.add(key); return true })
    .map(item => original.find(old => old.provider === item.provider && old.id === item.id) ?? item)
  let queue = [...original]
  if (action === 'next' && current) {
    queue = queue.filter(item => !selected.includes(item) || item === current)
    queue.splice(queue.indexOf(current) + 1, 0, ...selected.filter(item => item !== current))
  }
  else queue.push(...selected.filter(item => !queue.includes(item)))
  setPlayQueueState(queue)
  if (playMode() === 'random') setRandomPlayQueueState(createRandomOrder(queue.length))
  if (action === 'play') {
    await startPlaying(selected[0], queue.indexOf(selected[0]!))
    await setPlaying(true)
  }
  else if (!current) {
    await startPlaying(queue[0], 0)
    await setPlaying(false)
  }
  else setCurrentIndexState(queue.indexOf(current))
}

/**
 * 从播放列表中移除
 */
export async function removeFromPlayQueue(index: number) {
  if (dispatchRoomPlayer({ type: 'remove', index })) return
  const list = playQueue().filter((_, i) => i !== index)
  setPlayQueueState(list)
  const random = randomPlayQueue()
  if (playMode() === 'random' && random) {
    // 与原先的 splice(findIndex(...), 1) 保持一致（含找不到时的 -1 行为）
    const position = random.findIndex(i => i === index)
    setRandomPlayQueueState(
      random
        .filter((_, i) => i !== position)
        // 调整随机列表中大于被删除索引的值
        .map(i => i > index ? i - 1 : i),
    )
  }

  const current = currentIndex()

  if (list.length === 0 || current === null) {
    setShowPlayQueue(false)
    resetPlayer()
    return
  }

  if (current > index) {
    setCurrentIndexState(current - 1)
  }
  else if (current === index) {
    const nextIndex = current % list.length
    await startPlaying(list[nextIndex], nextIndex)
    await setPlaying(playing())
  }
}

export function setPlayMode(mode: PlayMode) {
  if (dispatchRoomPlayer({ type: 'mode', mode })) return
  setPlayModeState(mode)
  if (mode === 'random') {
    setRandomPlayQueueState(createRandomOrder(playQueue().length))
  }
  else {
    setRandomPlayQueueState(null)
  }
}

/**
 * 切换播放模式
 */
export function togglePlayMode() {
  switch (playMode()) {
    case 'order':
      setPlayMode('loop')
      break
    case 'loop':
      setPlayMode('random')
      break
    case 'random':
      setPlayMode('single-loop')
      break
    case 'single-loop':
      setPlayMode('order')
      break
  }
}

/**
 * 清空播放列表
 */
export function clearPlayQueue() {
  setPlayQueue([])
}

/** Apply room metadata without triggering autoplay, user intents or personal restoration. */
export function applyRoomQueue(items: MusicInfo[], index: number | null, mode: PlayMode) {
  setPlayQueueState(items)
  setCurrentIndexState(index)
  setDuration(index === null ? 0 : items[index]?.duration ?? 0)
  setPlayModeState(mode)
  setRandomPlayQueueState(null)
}

/** Cancel in-flight source work too, so an old provider cannot replace a new room track. */
export function cancelRoomSource() {
  sourceRevision++
  playIntent++
  abortController?.abort()
  abortController = null
  audio.pause()
  // load() can discard the queued native pause event while clearing a revoked stream.
  setPlayingState(false); setWaiting(false); setSeekingState(false)
  if (roomMedia) { roomMedia = false; audio.removeAttribute('src'); audio.load() }
}

export async function loadRoomSource(music: MusicInfo, index: number, signal: AbortSignal, qualityName?: string, hostedUrl?: string) {
  const pendingRevision = sourceRevision + 1
  const abort = () => { if (sourceRevision === pendingRevision) cancelRoomSource() }
  signal.addEventListener('abort', abort, { once: true })
  try {
    if (signal.aborted) return 'stale' as const
    if (hostedUrl) {
      cancelRoomSource()
      restoredPlayback = null; restoredSeek = null
      if (objectUrl) { URL.revokeObjectURL(objectUrl); objectUrl = null }
      setCurrentIndexState(index); setCurrentTimeState(0); setDuration(music.duration)
      setPlaybackError(null); setWaiting(true); setSeekingState(false)
      setCurrentSourceInfo({ url: hostedUrl, availability: 'full', qualities: [{ name: '房间托管', url: hostedUrl, active: true }] })
      // Stream directly, including in Web mode; never turn the room stream into a Blob.
      roomMedia = true; audio.crossOrigin = 'anonymous'; audio.src = hostedUrl; audio.load()
      return 'loaded' as const
    }
    await startPlaying(music, index)
    if (signal.aborted || sourceRevision !== pendingRevision) return 'stale' as const
    const info = currentSourceInfo()
    if (!audio.getAttribute('src') || !info) throw new Error(playbackError() || '无法获取音源')
    if (info.availability === 'preview') throw new Error('当前账号只能试听，无法使用完整歌曲时间轴一起听')
    if (info.availability !== 'full') throw new Error('该音源尚未确认完整播放权限，无法一起听')
    const quality = qualityName && info.qualities?.find(q => q.name === qualityName)
    if (quality) await loadQuality(info, quality)
    if (signal.aborted || sourceRevision !== pendingRevision) return 'stale' as const
    return 'loaded' as const
  }
  finally { signal.removeEventListener('abort', abort) }
}
// #endregion
