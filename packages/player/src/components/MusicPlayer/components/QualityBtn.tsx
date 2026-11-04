import type { MusicQuality } from '@m-part/music/types/music-info'
import Select from '~/components/Select/Select'

export interface QualityBtnProps {
  portalMount?: HTMLElement
  qualities: MusicQuality[]
  onSelect?: (quality: MusicQuality) => void
}

export default function QualityBtn(props: QualityBtnProps) {
  return (
    <Select
      portalMount={props.portalMount}
      options={props.qualities.map(quality => ({ value: quality.name, label: quality.name }))}
      value={props.qualities.find(quality => quality.active)?.name}
      onValueChange={name => { const quality = props.qualities.find(item => item.name === name); if (quality && !quality.active) props.onSelect?.(quality) }}
      aria-label="选择音质"
      triggerClass="ghost-btn size-9 !border-0 !bg-transparent !p-0 !gap-0 text-muted-foreground !shadow-none"
      renderValue={() => <span class="i-solar:high-quality-outline text-5" />}
      side="top"
      align="end"
      sideOffset={8}
      alignItemWithTrigger={false}
    />
  )
}
