import type { MusicInfo } from '@m-part/music/types/music-info'
import type { ContextMenuTriggerProps } from '~/components/ContextMenu/ContextMenu'
import type { JSX } from '@solidjs/web'
import ContextMenu from '~/components/ContextMenu/ContextMenu'
import { addNextToPlayQueue, currentSong, openBiliParts } from '~/composables/player'

export default function MusicContextMenu(props: { music: MusicInfo, disabled?: boolean, children: (props: ContextMenuTriggerProps) => JSX.Element }) {
  return (
    <ContextMenu label="歌曲操作" getItems={() => [{
      id: 'play-next',
      label: '添加到下一首',
      icon: 'i-lucide:list-plus',
      disabled: props.disabled || currentSong()?.provider === props.music.provider && currentSong()?.id === props.music.id,
      onSelect: () => { void addNextToPlayQueue(props.music) },
    }, ...(props.music.provider === 'bili' ? [{ id: 'select-parts', label: '选择分 P', icon: 'i-lucide:list-video', disabled: props.disabled, onSelect: () => { void openBiliParts(props.music) } }] : [])]}>
      {trigger => props.children(trigger)}
    </ContextMenu>
  )
}
