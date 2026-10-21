import type { MusicInfo } from '#shared/types/music-info'
import type { ContextMenuTriggerProps } from '~/components/ContextMenu/ContextMenu'
import type { JSX } from '@solidjs/web'
import ContextMenu from '~/components/ContextMenu/ContextMenu'
import { addNextToPlayQueue, currentSong } from '~/composables/player'

export default function MusicContextMenu(props: { music: MusicInfo, disabled?: boolean, children: (props: ContextMenuTriggerProps) => JSX.Element }) {
  return (
    <ContextMenu label="歌曲操作" getItems={() => [{
      id: 'play-next',
      label: '添加到下一首',
      icon: 'i-lucide:list-plus',
      disabled: props.disabled || currentSong()?.provider === props.music.provider && currentSong()?.id === props.music.id,
      onSelect: () => { void addNextToPlayQueue(props.music) },
    }]}>
      {trigger => props.children(trigger)}
    </ContextMenu>
  )
}
