import { clsx } from 'cn/lite'
import Popover from '~/components/Popover/Popover'
import VolumeSlider from './VolumeSlider'

export interface VolumeBtnProps {
  value: number
  onValueChange?: (value: number) => void
}

/** 窄屏把横向音量控件收进浮层，避免挤占歌曲信息。 */
export default function VolumeBtn(props: VolumeBtnProps) {
  return (
    <Popover
      triggerAttrs={{ class: 'ghost-btn size-9 text-muted-foreground', 'aria-label': '调整音量', 'aria-haspopup': 'dialog' }}
      trigger={<span class={clsx('text-4.5', props.value === 0 ? 'i-lucide:volume-x' : props.value < 0.5 ? 'i-lucide:volume-1' : 'i-lucide:volume-2')} />}
      contentAttrs={{ class: 'p-3 mb-3 w-max', role: 'dialog', 'aria-label': '调整音量' }}
      content={<VolumeSlider value={props.value} onValueChange={value => props.onValueChange?.(value)} />}
    />
  )
}
