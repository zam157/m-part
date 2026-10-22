import { createEffect, createRoot } from 'solid-js'
import {
  audio, currentIndex, currentTime, playMode, playQueue, randomPlayQueue, restorePlayerSession, volume,
} from './player'
import type { PlayerCache, PlayerStorage, StoredPosition } from '~/utils/player-storage'
import { createPlayerCacheWriter, createPlayerStorage, queueForStorage } from '~/utils/player-storage'
import { roomPlayerActive } from './player-context'

let capturePersonal: (() => Promise<PlayerCache>) | undefined
export async function savePersonalPlayerSession() {
  if (!capturePersonal) throw new Error('播放器缓存尚未初始化，请稍后再试')
  return capturePersonal()
}

function state() {
  return { items: playQueue(), index: currentIndex(), time: currentTime(), volume: volume(), mode: playMode(), order: randomPlayQueue(), room: roomPlayerActive() }
}
function position(snapshot: ReturnType<typeof state>): StoredPosition {
  const song = snapshot.index === null ? undefined : snapshot.items[snapshot.index]
  return { song: song ? { provider: song.provider, id: song.id } : null, time: song ? snapshot.time : 0 }
}
function queueChanged(a: ReturnType<typeof state>, b: ReturnType<typeof state>) {
  return a.items !== b.items || a.mode !== b.mode || a.order !== b.order
}

/** 应用入口启动一次；高频信号只更新内存，数据库不参与渲染与播放。 */
export function startPlayerPersistence(storage: PlayerStorage = createPlayerStorage()) {
  let previous = state()
  let queueTouched = false
  let volumeTouched = false
  let ready = false
  let disposed = false
  let warned = false
  const reportError = (error: unknown) => {
    if (!warned) {
      warned = true
      console.warn('播放器缓存暂不可用，当前播放不受影响。', error)
    }
  }
  const writer = createPlayerCacheWriter(storage, reportError)
  const disposeEffect = createRoot((dispose) => {
    createEffect(state, (next) => {
      const changedQueue = queueChanged(previous, next)
      const changedPosition = previous.index !== next.index || previous.time !== next.time
      const changedVolume = previous.volume !== next.volume
      if (!ready) {
        queueTouched ||= changedQueue || changedPosition
        volumeTouched ||= changedVolume
      }
      else if (!next.room) {
        if (changedQueue || previous.index !== next.index) {
          // 同一事务中保存队列与当前曲目，索引重排不能配上旧进度。
          writer.schedule({
            ...(changedQueue ? { queue: queueForStorage(next.items, next.mode, next.order) } : {}),
            position: position(next),
          }, 200)
        }
        else if (changedPosition) {
          writer.schedule({ position: position(next) }, 5000)
        }
      }
      if (ready && changedVolume) writer.schedule({ volume: next.volume }, 500)
      previous = next
    })
    return dispose
  })

  // pause/seeked 在媒体事件及 Solid 写入提交后补存；不是每个 timeupdate 都写库。
  const flush = async () => {
    await Promise.resolve()
    if (!ready || disposed)
      return
    await writer.flush()
  }
  const onBoundary = () => { void flush() }
  const onVisibility = () => { if (document.visibilityState === 'hidden') onBoundary() }
  audio.addEventListener('pause', onBoundary)
  audio.addEventListener('seeked', onBoundary)
  document.addEventListener('visibilitychange', onVisibility)
  window.addEventListener('pagehide', onBoundary)

  const initialized = (async () => {
    try {
      const cache = await storage.read()
      if (disposed)
        return
      const applyQueue = !queueTouched
      const applyVolume = !volumeTouched
      restorePlayerSession({
        ...(applyQueue ? { queue: cache.queue, position: cache.position } : {}),
        ...(applyVolume ? { volume: cache.volume } : {}),
      })
      // 恢复产生的信号变化不属于用户操作，不应安排一次多余的回写。
      await Promise.resolve()
      queueTouched = !applyQueue
      volumeTouched = !applyVolume
    }
    catch (error) {
      if (!disposed)
        reportError(error)
    }
    // 等恢复写入提交，避免把默认空队列写回并覆盖缓存。
    await Promise.resolve()
    if (disposed)
      return
    const next = state()
    previous = next
    ready = true
    // 恢复期间用户已操作过的值优先，并保存新的状态。
    const patch: PlayerCache = {}
    if (queueTouched) {
      patch.queue = queueForStorage(next.items, next.mode, next.order)
      patch.position = position(next)
    }
    if (volumeTouched)
      patch.volume = next.volume
    if (Object.keys(patch).length)
      writer.schedule(patch, 200)
  })()

  const capture = async () => {
    await initialized
    await flush()
    const snapshot = state()
    if (snapshot.room) throw new Error('当前已经在房间中')
    const cache = { queue: queueForStorage(snapshot.items, snapshot.mode, snapshot.order), position: position(snapshot) }
    // Explicit write: unlike background persistence, a failed protective save blocks joining.
    await storage.write(cache)
    return cache
  }
  capturePersonal = capture

  return {
    ready: initialized,
    flush,
    dispose() {
      if (capturePersonal === capture) capturePersonal = undefined
      disposed = true
      disposeEffect()
      writer.dispose()
      storage.close()
      audio.removeEventListener('pause', onBoundary)
      audio.removeEventListener('seeked', onBoundary)
      document.removeEventListener('visibilitychange', onVisibility)
      window.removeEventListener('pagehide', onBoundary)
    },
  }
}
