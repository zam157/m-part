import { clsx } from 'cn/lite'
import { Show } from 'solid-js'

export interface ErrorMessageProps {
  /** 失败原因，通常是 error.message */
  message: string
  /** 重试回调，提供后才会渲染重试按钮 */
  onRetry?: () => void
  /** 追加到根节点的类名，便于放进网格或铺满容器 */
  class?: string
}

/**
 * 数据加载失败时的占位，与 `empty` 空状态同构，可以直接替换它。
 *
 * 失败必须说出来：解析成「没有数据」会让用户以为真的什么都没有，
 * 把原因（例如 `Failed to fetch user videos (412)`）显示出来才分得清
 * 「确实没有」和「请求被拒」。
 */
export default function ErrorMessage(props: ErrorMessageProps) {
  return (
    <div class={clsx('empty', props.class)}>
      <span class="i-solar:danger-circle-bold text-4xl text-foreground/20" />
      <div class="flex flex-col gap-1">
        <span class="text-sm font-medium text-foreground/60">
          加载失败
        </span>
        <span class="text-xs text-muted-foreground break-all">
          {props.message}
        </span>
      </div>
      <Show when={props.onRetry}>
        <button
          class="btn px-3"
          onClick={() => props.onRetry?.()}
        >
          重试
        </button>
      </Show>
    </div>
  )
}
