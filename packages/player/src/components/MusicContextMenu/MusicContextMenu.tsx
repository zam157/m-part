import { getTrackPartsLabel, supportsTrackParts } from '~/utils/track-parts'
import type { MusicInfo } from '@m-part/music/types/music-info'
import type { ContextMenuTriggerProps } from '~/components/ContextMenu/ContextMenu'
import type { JSX } from '@solidjs/web'
import ContextMenu from '~/components/ContextMenu/ContextMenu'
import { addNextToPlayQueue, currentSong, openTrackParts } from '~/composables/player'
import { setLocalPlaylistDialog } from '~/composables/local-playlists'
import { downloadMusic, downloading } from '~/composables/download'

export default function MusicContextMenu(props: { music: MusicInfo, disabled?: boolean, children: (props: ContextMenuTriggerProps) => JSX.Element }) {
  return (
    <ContextMenu label="歌曲操作" getItems={() => [{
      id: 'play-next',
      label: '添加到下一首',
      icon: 'i-lucide:list-plus',
      disabled: props.disabled || currentSong()?.provider === props.music.provider && currentSong()?.id === props.music.id,
      onSelect: () => { void addNextToPlayQueue(props.music) },
    }, {
      id: 'add-local-playlist',
      label: '添加到本地歌单',
      icon: 'i-lucide:library',
      disabled: props.disabled,
      onSelect: () => setLocalPlaylistDialog({ kind: 'add', music: props.music }),
    }, {
      id: 'download',
      label: downloading() ? '正在下载…' : '下载歌曲',
      icon: 'i-lucide:download',
      disabled: downloading(),
      onSelect: () => { void downloadMusic(props.music) },
    }, ...(supportsTrackParts(props.music) ? [{ id: 'select-parts', label: `选择${getTrackPartsLabel(props.music)}`, icon: 'i-lucide:list-video', disabled: props.disabled, onSelect: () => { void openTrackParts(props.music) } }] : [])]}>
      {trigger => props.children(trigger)}
    </ContextMenu>
  )
}
