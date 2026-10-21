import { clsx } from 'cn/lite'

/** 桌面播放栏使用原生横向滑块，保留键盘及触摸操作。 */
export default function VolumeSlider(props: { value: number, onValueChange: (value: number) => void }) {
  let previousVolume = 1
  function toggleMuted() {
    if (props.value > 0) {
      previousVolume = props.value
      props.onValueChange(0)
    }
    else {
      props.onValueChange(previousVolume)
    }
  }
  return (
    <div class="flex items-center gap-2">
      <button class="ghost-btn size-7 text-muted-foreground" aria-label={props.value === 0 ? '取消静音' : '静音'} onClick={toggleMuted}>
        <span class={clsx('text-4', props.value === 0 ? 'i-lucide:volume-x' : props.value < 0.5 ? 'i-lucide:volume-1' : 'i-lucide:volume-2')} />
      </button>
      <input
        type="range"
        aria-label="音量"
        min={0}
        max={1}
        step={0.01}
        value={props.value}
        style={{ '--volume-percent': `${props.value * 100}%` }}
        class="player-volume-slider w-22 h-5 cursor-pointer bg-transparent appearance-none outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-full"
        onInput={event => props.onValueChange(event.currentTarget.valueAsNumber)}
      />
    </div>
  )
}
