import { clsx } from 'cn/lite'
import { createEffect, createMemo, createSignal, For, Match, Show, Switch, untrack } from 'solid-js'
import ErrorMessage from '~/components/ErrorMessage/ErrorMessage'
import { createLyrics } from '~/composables/lyrics'
import { audio, currentSong, currentTime, duration, playing, setCurrentTime, waiting } from '~/composables/player'
import { activeLyricIndex, lyricWordProgress } from '~/utils/lyrics'
import './lyrics.css'

export default function Lyrics(props: { visible: boolean, class?: string }) {
  let scrollRef!: HTMLDivElement
  const lyrics = createLyrics(currentSong, () => props.visible)
  const [following, setFollowing] = createSignal(true)
  const [translation, setTranslation] = createSignal(true)
  const [frameTime, setFrameTime] = createSignal(0)
  const hasWords = createMemo(() => lyrics.lines().some(line => line.words?.length))
  const lyricTime = () => props.visible && hasWords() && playing() ? frameTime() : currentTime()
  const active = createMemo(() => activeLyricIndex(lyrics.lines(), lyricTime()))
  const hasTranslation = () => lyrics.lines().some(line => line.translation)
  const instrumental = () => lyrics.data()?.instrumental || lyrics.lines().some(line => /^纯音乐[，,]?\s*请欣赏/.test(line.text))
  const canSeek = (time: number | null) => time !== null && !waiting() && Number.isFinite(duration()) && duration() > 0 && time <= duration()

  // 只在可见且播放逐字歌词时逐帧读取真实媒体时间；暂停、收起和后台均停止。
  createEffect(() => props.visible && hasWords() && playing(), (enabled) => {
    if (!enabled) return
    let frame = 0
    function tick() {
      setFrameTime(audio.currentTime)
      frame = requestAnimationFrame(tick)
    }
    function syncVisibility() {
      cancelAnimationFrame(frame)
      if (document.visibilityState === 'visible') tick()
    }
    syncVisibility()
    document.addEventListener('visibilitychange', syncVisibility)
    return () => {
      cancelAnimationFrame(frame)
      document.removeEventListener('visibilitychange', syncVisibility)
    }
  })

  createEffect(() => [props.visible, lyrics.lines()] as const, () => { setFollowing(true) })
  function followLine() {
    if (!props.visible || !following() || !scrollRef.clientHeight) return
    const line = scrollRef.querySelector<HTMLElement>(`[data-line="${active()}"]`)
    const top = line ? scrollRef.scrollTop + line.getBoundingClientRect().top - scrollRef.getBoundingClientRect().top - scrollRef.clientHeight * 0.35 : 0
    scrollRef.scrollTo({ top: Math.max(0, top), behavior: window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' })
  }
  createEffect(() => [props.visible, active(), following(), translation(), lyrics.lines()] as const, () => untrack(followLine))
  createEffect(() => props.visible, (visible) => {
    if (!visible || typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(() => untrack(followLine))
    observer.observe(scrollRef)
    return () => observer.disconnect()
  })

  return (
    <section aria-label="歌词" class={clsx('relative flex min-h-0 min-w-0 flex-col', props.class)}>
      <header class="flex shrink-0 items-center justify-between gap-3 px-3 pb-4">
        <h2 class="text-sm font-medium text-muted-foreground">歌词</h2>
        <Show when={hasTranslation()}><button class="ghost-btn h-7 px-2 text-xs" aria-label="显示翻译" aria-pressed={translation() ? 'true' : 'false'} onClick={() => setTranslation(value => !value)}>译文</button></Show>
      </header>
      <div
        ref={scrollRef}
        class="lyrics-scroll flex-1 min-h-0 overflow-y-auto overflow-x-hidden overscroll-contain px-3"
        tabindex={0}
        aria-label="歌词内容"
        aria-busy={lyrics.loading() ? 'true' : 'false'}
        onPointerDown={(event) => { if (event.target === event.currentTarget) setFollowing(false) }}
        onWheel={() => setFollowing(false)}
        onTouchMove={() => setFollowing(false)}
        onKeyDown={(event) => { if (['ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', 'Home', 'End'].includes(event.key)) setFollowing(false) }}
      >
        <Switch>
          <Match when={lyrics.error()}><ErrorMessage message={lyrics.error()!} onRetry={lyrics.retry} class="h-full" /></Match>
          <Match when={lyrics.loading()}><div class="h-full flex flex-col justify-center gap-6" role="status" aria-label="正在加载歌词"><div class="skeleton h-7 w-3/4" /><div class="skeleton h-7 w-full" /><div class="skeleton h-7 w-1/2" /></div></Match>
          <Match when={instrumental()}><div class="empty h-full text-muted-foreground"><span class="i-lucide:music-2 text-9 opacity-40" /><p>纯音乐，请欣赏</p></div></Match>
          <Match when={lyrics.lines().length}>
            <div class="grid grid-cols-1 gap-5 pt-[20dvh] pb-[30dvh] max-[900px]:pt-8 max-[900px]:pb-[15dvh]">
              <For each={lyrics.lines()}>{(line, index) => (
                <div data-line={index()} class="min-w-0">
                  <Show when={line.time !== null} fallback={<p class="whitespace-pre-line text-6 leading-relaxed font-semibold text-muted-foreground">{line.text}</p>}>
                    <button
                      class="lyric-line block w-full rounded-lg py-1 text-left whitespace-pre-line break-words text-7 leading-snug font-semibold tracking-tight outline-none focus-visible:ring-2 focus-visible:ring-ring max-[900px]:text-6"
                      aria-current={active() === index() ? 'true' : undefined}
                      aria-label={`跳转到 ${line.text || '间奏'}`}
                      disabled={!canSeek(line.time)}
                      onClick={() => { if (canSeek(line.time)) { setCurrentTime(line.time!); setFollowing(true) } }}
                    >
                      <span class="block whitespace-pre-wrap">
                        <Show when={line.words?.length} fallback={line.text || '· · ·'}>
                          <For each={line.words}>{word => (
                            <span class="lyric-word" style={{ '--word-progress': `${active() === index() ? lyricWordProgress(word, lyricTime()) * 100 : 0}%` }}>{word.text}</span>
                          )}</For>
                        </Show>
                      </span>
                      <Show when={translation() && line.translation}><span class="block mt-2 text-base font-normal leading-relaxed opacity-75">{line.translation}</span></Show>
                      <Show when={line.romanization}><span class="block mt-1 text-sm font-normal leading-relaxed opacity-60">{line.romanization}</span></Show>
                    </button>
                  </Show>
                </div>
              )}</For>
            </div>
          </Match>
          <Match when={true}><div class="empty h-full text-muted-foreground"><span class="i-lucide:captions-off text-9 opacity-40" /><p>{currentSong()?.provider === 'bili' ? '此音源暂不提供歌词' : '暂无歌词'}</p></div></Match>
        </Switch>
      </div>
      <Show when={!following() && active() >= 0}><button class="border-btn absolute bottom-3 left-1/2 -translate-x-1/2 h-8 px-3 text-xs bg-background shadow-md" onClick={() => setFollowing(true)}><span class="i-lucide:locate-fixed text-3.5 mr-1.5" />回到当前歌词</button></Show>
    </section>
  )
}
