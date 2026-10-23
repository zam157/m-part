import { clsx } from 'cn/lite'
import { Show } from 'solid-js'
import Tooltip from '~/components/Tooltip/Tooltip'
import { currentSong, playing, playMode, prevNext, seeking, togglePlayMode, waiting } from '~/composables/player'
import { canControlRoom } from '~/composables/player-context'
import { playModeLabel, togglePlayback } from './player-controls'

export default function PlaybackControls(props: { expanded?: boolean, portalMount?: HTMLElement }) {
  const hasSong = () => !!currentSong()
  const showSpinner = () => waiting() || seeking()
  // UnoCSS 的默认扫描范围包含 TSX；图标字面量保留在组件中。
  const playModeIcon = () => ({ order: 'i-lucide:list-ordered', loop: 'i-lucide:repeat', random: 'i-lucide:shuffle', 'single-loop': 'i-lucide:repeat-1' }[playMode()])
  return (
    <div role="group" aria-label="播放控制" class={clsx('flex items-center', props.expanded ? 'justify-between gap-3 max-[400px]:gap-2' : 'gap-1 justify-self-start max-[760px]:row-start-2')}>
      <Tooltip portalMount={props.portalMount} content={`${playModeLabel()}，${canControlRoom() ? '点击切换' : '由房主控制'}`}>
        {trigger => (
          <button {...trigger} class={clsx('ghost-btn text-muted-foreground', props.expanded ? 'size-10' : 'size-8')} disabled={!hasSong() || !canControlRoom()} aria-label={`播放模式：${playModeLabel()}`} onClick={togglePlayMode}>
            <span class={clsx(playModeIcon(), 'text-4')} />
          </button>
        )}
      </Tooltip>
      <button class={clsx('ghost-btn', props.expanded ? 'size-12' : 'size-9')} disabled={!hasSong() || !canControlRoom()} aria-label="上一首" onClick={() => prevNext(0)}><span class="i-solar:skip-previous-bold text-5" /></button>
      <button class={props.expanded ? 'btn size-16 rounded-full shadow-sm' : 'ghost-btn size-11'} disabled={!hasSong()} aria-label={playing() ? '暂停' : '播放'} onClick={togglePlayback}>
        <span class={clsx(props.expanded ? 'text-8' : 'text-7', showSpinner() ? 'i-lucide:loader-circle animate-spin motion-reduce:animate-none' : playing() ? 'i-solar:pause-bold' : 'i-solar:play-bold')} />
      </button>
      <button class={clsx('ghost-btn', props.expanded ? 'size-12' : 'size-9')} disabled={!hasSong() || !canControlRoom()} aria-label="下一首" onClick={() => prevNext(1)}><span class="i-solar:skip-next-bold text-5" /></button>
      <Show when={props.expanded}><span class="size-10" aria-hidden="true" /></Show>
    </div>
  )
}
