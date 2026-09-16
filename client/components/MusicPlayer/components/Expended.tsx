export interface ExpendedProps {
  /** 是否展开（替代 v-model:show） */
  show: boolean
  onShowChange?: (show: boolean) => void
}

export default function Expended(props: ExpendedProps) {
  return (
    <div
      class="fixed inset-0 z-50 bg-background flex flex-col"
      style={{ display: props.show ? undefined : 'none' }}
    >
      <div class="h-12 flex items-center px-4 py-2">
        <button class="ghost-btn size-10" onClick={() => props.onShowChange?.(false)}>
          <div class="i-lucide:chevrons-down text-6" />
        </button>
      </div>
      <div class="flex-1 min-h-0 flex items-center justify-center text-sm font-medium">
        Expanded Player
      </div>
    </div>
  )
}
