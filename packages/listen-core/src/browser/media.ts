export async function prepareMedia(audio: HTMLAudioElement, target: number, signal: AbortSignal, timeoutMs = 8_000): Promise<'ready' | 'stale'> {
  if (signal.aborted) return 'stale'
  return new Promise((resolve, reject) => {
    let positioned = false
    const events = ['loadedmetadata', 'loadeddata', 'canplay', 'seeked', 'progress', 'error']
    const cleanup = () => {
      clearTimeout(timeout)
      for (const event of events) audio.removeEventListener(event, check)
      signal.removeEventListener('abort', abort)
    }
    const abort = () => { cleanup(); resolve('stale') }
    const check = () => {
      if (audio.error) { cleanup(); reject(new Error(audio.error.message || '测试音频加载失败')); return }
      if (audio.readyState < 1 || !Number.isFinite(audio.duration)) return
      if (!positioned) {
        positioned = true
        if (Math.abs(audio.currentTime - target) > 0.08) {
          audio.currentTime = Math.max(0, Math.min(audio.duration, target))
          return
        }
      }
      if (audio.readyState >= 2 && !audio.seeking && Math.abs(audio.currentTime - target) <= 0.12) {
        cleanup(); resolve('ready')
      }
    }
    const timeout = setTimeout(() => { cleanup(); reject(new Error('媒体准备超时')); }, timeoutMs)
    for (const event of events) audio.addEventListener(event, check)
    signal.addEventListener('abort', abort, { once: true })
    check()
  })
}

export function startMedia(audio: HTMLAudioElement, signal: AbortSignal, timeoutMs = 8_000): Promise<'playing' | 'stale'> {
  if (signal.aborted) return Promise.resolve('stale')
  return new Promise((resolve, reject) => {
    let finished = false
    const finish = (result: 'playing' | 'stale' | { error: unknown }) => {
      if (finished) return
      finished = true
      clearTimeout(timer)
      signal.removeEventListener('abort', abort)
      if (typeof result === 'string') resolve(result)
      else reject(result.error)
    }
    const abort = () => finish('stale')
    const timer = setTimeout(() => { audio.pause(); finish({ error: new Error('播放启动超时') }) }, timeoutMs)
    signal.addEventListener('abort', abort, { once: true })
    try {
      audio.play().then(() => {
        if (finished && !signal.aborted) audio.pause()
        else finish(signal.aborted ? 'stale' : 'playing')
      }, error => finish({ error }))
    }
    catch (error) { finish({ error }) }
  })
}
