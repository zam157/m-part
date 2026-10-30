import { Portal } from '@solidjs/web'
import { clsx } from 'cn/lite'
import { createEffect, createSignal, onCleanup, Show, untrack } from 'solid-js'
import { closeContextMenu } from '~/components/ContextMenu/state'
import {
  currentSong, currentSourceInfo, playing, playQueue,
  setPlaying, setVolume, volume,
} from '~/composables/player'
import Lyrics from '~/components/Lyrics/Lyrics'
import { roomPlayerActive } from '~/composables/player-context'
import PlayQueue from '~/components/PlayQueue/PlayQueue'
import PlaybackControls from './PlaybackControls'
import PlaybackProgress from './PlaybackProgress'
import QualityBtn from './QualityBtn'
import VolumeSlider from './VolumeSlider'
import { selectQuality } from './player-controls'
import '../expanded-player.css'

export interface ExpandedPlayerProps {
  show: boolean
  onShowChange: (show: boolean) => void
  ref?: (element: HTMLDialogElement) => void
}

export default function ExpandedPlayer(props: ExpandedPlayerProps) {
  let dialogRef!: HTMLDialogElement
  const [showLyrics, setShowLyrics] = createSignal(false)
  const [showQueue, setShowQueue] = createSignal(false)
  const [showTranslation, setShowTranslation] = createSignal(true)
  const [hasTranslation, setHasTranslation] = createSignal(false)
  const close = () => props.onShowChange(false)
  function closeDialog() {
    for (const popover of dialogRef.querySelectorAll<HTMLElement>('[popover]'))
      popover.hidePopover()
    dialogRef.close()
  }

  // 动画交给 CSS；JS 只同步原生对话框的打开状态，不测量布局或逐帧更新。
  createEffect(() => props.show, (show) => {
    closeContextMenu()
    untrack(() => {
      if (show && !dialogRef.open)
        dialogRef.showModal()
      else if (!show && dialogRef.open)
        closeDialog()
    })
  })
  createEffect(() => props.show && playQueue().length === 0, (empty) => {
    if (empty)
      close()
  })
  onCleanup(() => { if (dialogRef.open) closeDialog() })

  function handleKeyDown(event: KeyboardEvent) {
    if (event.defaultPrevented || event.key !== ' ' || !(event.target instanceof HTMLElement)
      || event.target.isContentEditable || event.target.closest('button, input, select, textarea, [role="slider"], [role="menu"]'))
      return
    event.preventDefault()
    void setPlaying(!playing())
  }

  return (
    <Portal>
      <dialog
        id="expanded-player"
        ref={element => { dialogRef = element; props.ref?.(element) }}
        aria-label="展开播放器"
        aria-modal="true"
        inert={!props.show}
        class="expanded-player fixed inset-0 m-0 w-full h-100dvh max-w-none max-h-none border-0 p-0 bg-background text-foreground outline-none overflow-hidden"
        onCancel={(event) => { event.preventDefault(); close() }}
        onClose={() => { if (!dialogRef.open && props.show) close() }}
        onKeyDown={handleKeyDown}
      >
        <div class="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
          <Show when={currentSong()?.coverUrl}><img src={currentSong()!.coverUrl} alt="" referrerpolicy="no-referrer" class="size-full object-cover blur-3xl scale-125 opacity-10" /></Show>
          <div class="absolute inset-0 bg-background/80" />
        </div>
        <header class="relative z-1 shrink-0 h-18 px-8 flex items-center justify-between gap-2 border-b border-border/60 max-[900px]:h-15 max-[900px]:px-4">
          <div class={clsx('shrink-0', hasTranslation() ? 'w-21 max-[900px]:w-26' : 'w-10 max-[900px]:w-17')}><button class="ghost-btn size-10" autofocus aria-label="收起播放器" onClick={close}><span class="i-lucide:chevron-down text-5" /></button></div>
          <div class="text-center shrink-0"><p class="text-xs tracking-[0.15em] text-muted-foreground">{roomPlayerActive() ? '一起听' : '正在播放'}</p><p class="text-xs font-medium mt-1">{currentSong()?.provider === 'netease' ? '网易云音乐' : currentSong()?.provider === 'qq' ? 'QQ音乐' : 'BiliBili'}</p></div>
          <div class="flex shrink-0 items-center gap-1">
            <button class={clsx('ghost-btn size-10 max-[900px]:size-8 min-[901px]:hidden', showLyrics() && 'bg-accent')} aria-label="显示歌词" aria-controls="expanded-lyrics" aria-expanded={showLyrics() ? 'true' : 'false'} onClick={() => setShowLyrics(value => !value)}><span class="i-lucide:captions text-5" /></button>
            <Show when={hasTranslation()}><button class={clsx('ghost-btn size-10 max-[900px]:size-8 text-sm', showTranslation() && 'bg-accent')} aria-label="显示翻译" aria-controls="expanded-lyrics" aria-pressed={showTranslation() ? 'true' : 'false'} onClick={() => setShowTranslation(value => !value)}>译</button></Show>
            <button class={clsx('ghost-btn size-10 max-[900px]:size-8', showQueue() && 'bg-accent')} aria-label="展开播放队列" aria-controls="expanded-play-queue" aria-expanded={showQueue() ? 'true' : 'false'} onClick={() => setShowQueue(value => !value)}><span class="i-lucide:list-music text-5" /></button>
          </div>
        </header>
        <div class="relative z-1 min-h-0 flex-1 overflow-y-auto overscroll-contain">
          <div class="grid grid-cols-[minmax(0,1fr)_minmax(300px,0.9fr)] items-center gap-16 max-w-6xl min-h-full mx-auto px-12 py-8 max-[1100px]:gap-9 max-[900px]:grid-cols-1 max-[900px]:px-6 max-[900px]:py-5 max-[900px]:gap-5 max-[400px]:px-5">
            <section aria-label="正在播放的歌曲" class={clsx('expanded-now-playing w-full max-w-110 mx-auto min-w-0', showLyrics() && 'max-[900px]:order-2')}>
              <div class={clsx('expanded-artwork aspect-square w-[min(44dvh,100%)] max-w-110 mx-auto overflow-hidden rounded-2xl border border-foreground/5 bg-muted shadow-[0_24px_70px_-20px_#0005] grid place-items-center max-[900px]:w-[min(38dvh,100%)]', showLyrics() && 'max-[900px]:hidden')}>
                <Show when={currentSong()?.coverUrl} fallback={<span class="i-lucide:music-2 text-16 text-muted-foreground/40" />}>
                  <img src={currentSong()!.coverUrl} alt="当前歌曲封面" referrerpolicy="no-referrer" class="size-full object-cover" />
                </Show>
              </div>
              <div class="expanded-controls mt-7 max-[900px]:mt-5">
                <div class="mb-4 min-w-0"><h1 class="text-7 leading-tight font-semibold tracking-tight line-clamp-2 max-[900px]:text-6">{currentSong()?.title || '尚未播放'}</h1><p class="text-base text-muted-foreground truncate mt-2">{currentSong()?.artist || '未知创作者'}</p><Show when={currentSong()?.album}><p class="text-xs text-muted-foreground/75 truncate mt-1">{currentSong()?.album}</p></Show></div>
                <PlaybackProgress expanded />
                <div class="mt-4 mb-5"><PlaybackControls expanded portalMount={dialogRef} /></div>
                {/* 音源加载时保留音质按钮尺寸，避免整列重新居中和音量条伸缩。 */}
                <div role="group" aria-label="音量与音质" class="flex h-9 items-center gap-4">
                  <div class="min-w-0 flex-1"><VolumeSlider expanded value={volume()} onValueChange={setVolume} /></div>
                  <div class="size-9 shrink-0"><Show when={currentSourceInfo()?.qualities?.length}><QualityBtn portalMount={dialogRef} qualities={currentSourceInfo()!.qualities!} onSelect={selectQuality} /></Show></div>
                </div>
              </div>
            </section>
            <div id="expanded-lyrics" class={clsx('min-w-0', showLyrics() ? 'max-[900px]:order-1' : 'max-[900px]:hidden')}>
              <Lyrics visible={props.show} showTranslation={showTranslation()} onTranslationAvailableChange={setHasTranslation} class="h-[min(72dvh,720px)] max-[900px]:h-[38dvh]" />
            </div>
          </div>
        </div>
        <PlayQueue floating open={props.show && showQueue()} onOpenChange={setShowQueue} />
      </dialog>
    </Portal>
  )
}
