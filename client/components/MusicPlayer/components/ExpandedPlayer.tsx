import { Portal } from '@solidjs/web'
import { clsx } from 'cn/lite'
import { createEffect, createSignal, onCleanup, Show, untrack } from 'solid-js'
import ErrorMessage from '~/components/ErrorMessage/ErrorMessage'
import { closeContextMenu } from '~/components/ContextMenu/state'
import {
  currentSong, currentSourceInfo, playbackError, playing, playQueue,
  setPlaying, setVolume, volume,
} from '~/composables/player'
import PlayQueue from '~/components/PlayQueue/PlayQueue'
import PlaybackControls from './PlaybackControls'
import PlaybackProgress from './PlaybackProgress'
import QualityBtn from './QualityBtn'
import VolumeSlider from './VolumeSlider'
import { retryPlayback, selectQuality } from './player-controls'
import '../expanded-player.css'

export interface ExpandedPlayerProps {
  show: boolean
  onShowChange: (show: boolean) => void
}

export default function ExpandedPlayer(props: ExpandedPlayerProps) {
  let dialogRef!: HTMLDialogElement
  const [showQueue, setShowQueue] = createSignal(false)
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
        ref={dialogRef}
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
        <header class="relative z-1 shrink-0 h-18 px-8 flex items-center justify-between gap-3 border-b border-border/60 max-[900px]:h-15 max-[900px]:px-4">
          <button class="ghost-btn size-10" autofocus aria-label="收起播放器" onClick={close}><span class="i-lucide:chevron-down text-5" /></button>
          <div class="text-center"><p class="text-xs tracking-[0.15em] text-muted-foreground">正在播放</p><p class="text-xs font-medium mt-1">{currentSong()?.provider === 'netease' ? '网易云音乐' : 'BiliBili'}</p></div>
          <div class="size-10"><button class={clsx('ghost-btn size-10', showQueue() && 'bg-accent')} aria-label="展开播放队列" aria-controls="expanded-play-queue" aria-expanded={showQueue() ? 'true' : 'false'} onClick={() => setShowQueue(value => !value)}><span class="i-lucide:list-music text-5" /></button></div>
        </header>
        <div class="relative z-1 min-h-0 flex-1 overflow-y-auto overscroll-contain">
          <div class="grid grid-cols-1 items-center gap-16 max-w-6xl min-h-full mx-auto px-12 py-8 max-[1100px]:gap-9 max-[900px]:grid-cols-1 max-[900px]:px-6 max-[900px]:py-5 max-[400px]:px-5">
            <section aria-label="正在播放的歌曲" class="expanded-now-playing w-full max-w-110 mx-auto min-w-0">
              <div class="expanded-artwork aspect-square w-[min(44dvh,100%)] max-w-110 mx-auto overflow-hidden rounded-2xl border border-foreground/5 bg-muted shadow-[0_24px_70px_-20px_#0005] grid place-items-center max-[900px]:w-[min(38dvh,100%)]">
                <Show when={currentSong()?.coverUrl} fallback={<span class="i-lucide:music-2 text-16 text-muted-foreground/40" />}>
                  <img src={currentSong()!.coverUrl} alt="当前歌曲封面" referrerpolicy="no-referrer" class="size-full object-cover" />
                </Show>
              </div>
              <div class="expanded-controls mt-7 max-[900px]:mt-5">
                <div class="mb-4 min-w-0"><h1 class="text-7 leading-tight font-semibold tracking-tight line-clamp-2 max-[900px]:text-6" innerHTML={currentSong()?.title || '尚未播放'} /><p class="text-base text-muted-foreground truncate mt-2">{currentSong()?.artist || '未知创作者'}</p><Show when={currentSong()?.album}><p class="text-xs text-muted-foreground/75 truncate mt-1">{currentSong()?.album}</p></Show></div>
                <Show when={playbackError()}><ErrorMessage message={playbackError() ?? ''} onRetry={retryPlayback} class="p-3 gap-2 mb-3 border border-border" /></Show>
                <PlaybackProgress expanded />
                <div class="mt-4 mb-5"><PlaybackControls expanded portalMount={dialogRef} /></div>
                <div class="flex items-center gap-4"><VolumeSlider expanded value={volume()} onValueChange={setVolume} /><Show when={currentSourceInfo()?.qualities?.length}><QualityBtn portalMount={dialogRef} qualities={currentSourceInfo()!.qualities!} onSelect={selectQuality} /></Show></div>
              </div>
            </section>

          </div>
        </div>
        <PlayQueue floating open={props.show && showQueue()} onOpenChange={setShowQueue} />
      </dialog>
    </Portal>
  )
}
