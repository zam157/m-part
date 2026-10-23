import type { MusicQuality } from '@m-part/music/types/music-info'
import { clsx } from 'cn/lite'
import { For } from 'solid-js'
import Popover from '~/components/Popover/Popover'
import type { PopoverApi } from '~/components/Popover/Popover'

export interface QualityBtnProps {
  portalMount?: HTMLElement
  qualities: MusicQuality[]
  onSelect?: (quality: MusicQuality) => void
}

export default function QualityBtn(props: QualityBtnProps) {
  let popover: PopoverApi | undefined
  return (
    <Popover
      ref={api => (popover = api)}
      portalMount={props.portalMount}
      triggerAttrs={{ class: 'ghost-btn size-9 text-muted-foreground', 'aria-label': '选择音质' }}
      trigger={<span class="i-solar:high-quality-outline text-5" />}
      contentAttrs={{ class: 'z-10 max-w-30 w-max max-h-80 overflow-y-auto p-1 mb-4' }}
      content={(
        <div class="flex flex-col gap-0.5 w-full">
          <For each={props.qualities}>
            {quality => (
              <button
                type="button"
                aria-pressed={quality.active ? 'true' : 'false'}
                class={clsx(
                  'ghost-btn flex px-2.5 py-1 text-3.5 w-full truncate',
                  quality.active && 'bg-accent fw-medium text-accent-foreground',
                )}
                onClick={() => {
                  if (!quality.active)
                    props.onSelect?.(quality)
                  popover?.hide()
                }}
              >
                {quality.name}
              </button>
            )}
          </For>
        </div>
      )}
    />
  )
}
