import { getTrackPartsLabel, supportsTrackParts } from '~/utils/track-parts'
import { clsx } from 'cn/lite'
import { createMemo, createSignal, Show } from 'solid-js'
import AlertPopover from '~/components/AlertPopover/AlertPopover'
import Tooltip from '~/components/Tooltip/Tooltip'
import { dismissRoomError, roomPlayerActive, roomView } from '~/composables/listen-room'
import {
  currentSong, currentSourceInfo, dismissPlaybackError, playbackError, setShowPlayQueue, setVolume, showPlayQueue, volume, openTrackParts,
} from '~/composables/player'
import { canControlRoom } from '~/composables/player-context'
import ExpandedPlayer from './components/ExpandedPlayer'
import PlaybackControls from './components/PlaybackControls'
import PlaybackProgress from './components/PlaybackProgress'
import QualityBtn from './components/QualityBtn'
import VolumeBtn from './components/VolumeBtn'
import VolumeSlider from './components/VolumeSlider'
import { retryPlayback, selectQuality } from './components/player-controls'
import './music-player.css'

export default function MusicPlayer() {
  const [showExpanded, setShowExpanded] = createSignal(false)
  let expandedDialog: HTMLDialogElement | undefined
  const hasSong = () => !!currentSong()
  // 房间每 250ms 更新状态；相同错误不重置浮层计时，也不重建重试按钮。
  const roomError = createMemo(() => roomView().error || null)
  const roomPlaybackFailed = createMemo(() => roomPlayerActive() && (roomView().status === 'failed' || roomView().status === 'blocked'))
  const canRetry = () => roomError() ? roomPlaybackFailed() : !!playbackError()
  function dismissError() {
    // 音源加载失败会同时写入播放器和房间，关闭时一起清除，避免旧错误再次弹出。
    dismissPlaybackError()
    dismissRoomError()
  }

  return (
    <footer aria-label="音乐播放器" class="relative shrink-0 bg-background select-none">
      <div class="grid grid-cols-[minmax(180px,1fr)_minmax(0,460px)_minmax(180px,1fr)] items-center gap-x-5 h-[--player-height] px-6 border-t border-border max-[760px]:grid-cols-[minmax(0,1fr)_auto] max-[760px]:gap-x-2 max-[760px]:gap-y-1 max-[760px]:px-4 max-[760px]:py-2 max-[400px]:px-3">
        <PlaybackControls />

        <div role="group" aria-label="当前歌曲" class="flex min-w-0 items-center gap-3 rounded-lg bg-muted/55 p-2 max-[760px]:col-span-2 max-[760px]:row-start-1">
          <button class="group/cover relative size-12 shrink-0 overflow-hidden rounded-md bg-muted outline-none focus-visible:ring-2 focus-visible:ring-ring" disabled={!hasSong()} aria-label="展开播放器" aria-controls="expanded-player" aria-expanded={showExpanded() ? 'true' : 'false'} onClick={() => setShowExpanded(true)}>
            <Show when={currentSong()?.coverUrl} fallback={<span class="i-lucide:music-2 text-6 text-muted-foreground" />}>
              <img src={currentSong()!.coverUrl} alt="当前歌曲封面" referrerpolicy="no-referrer" class="size-full object-cover" />
            </Show>
            <span class="absolute inset-0 grid place-items-center bg-black/35 text-white opacity-0 transition-opacity group-hover/cover:opacity-100 group-focus-visible/cover:opacity-100"><span class="i-lucide:chevrons-up text-5" /></span>
          </button>
          <div class="flex-1 min-w-0">
            <div class="text-center min-w-0">
              <span class="block truncate text-[13px] leading-4 font-semibold">{currentSong()?.title || '尚未播放'}</span>
              <span class="block truncate text-[11px] leading-4 text-muted-foreground">{hasSong() ? currentSong()?.artist || '未知创作者' : '搜索或选择歌曲开始播放'}</span>
            </div>
            <PlaybackProgress />
          </div>
        </div>

        <div role="group" aria-label="播放设置" class="flex items-center gap-3 justify-self-end max-[760px]:row-start-2 max-[760px]:gap-2">
          <Show when={supportsTrackParts(currentSong())}><button class="ghost-btn h-9 px-2 text-xs" aria-label={`选择当前曲目的${getTrackPartsLabel(currentSong())}`} disabled={!canControlRoom()} onClick={() => { const song = currentSong(); if (song) void openTrackParts(song) }}>{getTrackPartsLabel(currentSong())}</button></Show>
          <div class="max-[1100px]:hidden"><VolumeSlider value={volume()} onValueChange={setVolume} /></div>
          <div class="hidden max-[1100px]:block"><VolumeBtn value={volume()} onValueChange={setVolume} /></div>
          <Show when={currentSourceInfo()?.qualities?.length}>
            <QualityBtn qualities={currentSourceInfo()!.qualities!} onSelect={selectQuality} />
          </Show>
          <span class="h-5 w-px bg-border max-[760px]:hidden" aria-hidden="true" />
          <Tooltip content={showPlayQueue() ? '关闭播放队列' : '播放队列'}>
            {trigger => (
              <button {...trigger} class={clsx('ghost-btn size-9', showPlayQueue() && 'bg-accent text-accent-foreground')} aria-label="播放队列" aria-controls="play-queue" aria-expanded={showPlayQueue() ? 'true' : 'false'} onClick={() => setShowPlayQueue(!showPlayQueue())}>
                <span class="i-lucide:list-music text-4.5" />
              </button>
            )}
          </Tooltip>
        </div>
      </div>
      <ExpandedPlayer show={showExpanded()} onShowChange={setShowExpanded} ref={element => { expandedDialog = element }} />
      <AlertPopover
        title={roomError() && !roomPlaybackFailed() ? '一起听提示' : '播放失败'}
        message={roomError() || playbackError()}
        variant="destructive"
        onDismiss={dismissError}
        action={canRetry() ? { label: '重试', onClick: retryPlayback } : undefined}
        portalMount={showExpanded() ? expandedDialog : undefined}
      />
    </footer>
  )
}
