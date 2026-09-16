import type { MusicQuality } from '#shared/types/music-info'
import { For } from 'solid-js'
import Popover from '~/components/Popover/Popover'

export interface QualityBtnProps {
  qualities: MusicQuality[]
  onSelect?: (quality: MusicQuality) => void
}

export default function QualityBtn(props: QualityBtnProps) {
  return (
    <Popover
      triggerAttrs={{ class: 'i-solar:high-quality-outline text-5 text-primary transition-color hover:text-primary/80' }}
      contentAttrs={{ class: 'z-10 max-w-30 w-max max-h-80 overflow-y-auto p-1 mb-4' }}
      content={(
        <div class="flex flex-col gap-0.5 w-full">
          <For each={props.qualities}>
            {quality => (
              <div
                class={`ghost-btn flex px-2.5 py-1 text-3.5 w-full truncate ${quality.active ? 'bg-accent fw-medium text-accent-foreground' : ''}`.trim()}
                onClick={() => {
                  if (quality.active)
                    return
                  props.onSelect?.(quality)
                }}
              >
                {quality.name}
              </div>
            )}
          </For>
        </div>
      )}
    />
  )
}
