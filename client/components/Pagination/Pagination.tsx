import { clsx } from 'cn/lite'
import { createMemo, For, Show } from 'solid-js'

export interface PaginationProps {
  total: number
  pageSize?: number
  siblingCount?: number
  /** 当前页（受控，等价于原来的 v-model） */
  modelValue: number
  onPageChange?: (page: number) => void
}

export default function Pagination(props: PaginationProps) {
  const pageSize = () => props.pageSize ?? 20
  const siblingCount = () => props.siblingCount ?? 1

  const totalPages = createMemo(() => Math.ceil(props.total / pageSize()))

  const displayPages = createMemo<(number | string)[]>(() => {
    const pages: (number | string)[] = []
    const siblings = siblingCount()
    const total = totalPages()
    const maxPages = 2 * siblings + 5 // Left dots + siblings + page + siblings + right dots

    if (total <= maxPages) {
      // Show all pages if total is small
      return Array.from({ length: total }, (_, i) => i + 1)
    }

    // Always show first page
    pages.push(1)

    const leftSibling = Math.max(props.modelValue - siblings, 2)
    const rightSibling = Math.min(props.modelValue + siblings, total - 1)

    // Add left ellipsis if needed
    if (leftSibling > 2)
      pages.push('...')

    // Add sibling pages
    for (let i = leftSibling; i <= rightSibling; i++)
      pages.push(i)

    // Add right ellipsis if needed
    if (rightSibling < total - 1)
      pages.push('...')

    // Always show last page
    pages.push(total)

    return pages
  })

  function goToPage(page: number) {
    if (page >= 1 && page <= totalPages() && page !== props.modelValue)
      props.onPageChange?.(page)
  }

  function previousPage() {
    if (props.modelValue > 1) {
      const newPage = props.modelValue - 1
      goToPage(newPage)
      // 注：原实现这里会再 emit 一次（goToPage 内部已 emit），此处保持行为不变
      props.onPageChange?.(newPage)
    }
  }

  function nextPage() {
    if (props.modelValue < totalPages()) {
      const newPage = props.modelValue + 1
      goToPage(newPage)
      // 同上：保持原来的重复回调行为
      props.onPageChange?.(newPage)
    }
  }

  function pageClass(page: number | string) {
    if (page === props.modelValue)
      return 'border-btn'
    if (page !== '...')
      return 'ghost-btn active:translate-y-px'
    return undefined
  }

  return (
    <ul class="flex items-center justify-center gap-1">
      {/* Previous Button */}
      <li
        class="ghost-btn gap-1.5 pr-2.5 pl-1.5 active:translate-y-px"
        onClick={previousPage}
      >
        <div class="i-lucide:chevron-left text-4" />
        <span>上一页</span>
      </li>

      {/* Page Numbers */}
      <li class="flex items-center gap-1">
        <For each={displayPages()}>
          {(page) => {
            const isEllipsis = () => page === '...'
            return (
              <button
                type="button"
                class={clsx('w-8 h-8 p-0 flex items-center justify-center', pageClass(page))}
                onClick={() => {
                  if (typeof page === 'number')
                    goToPage(page)
                }}
              >
                <Show when={isEllipsis()} fallback={page}>
                  <div class="i-lucide:ellipsis text-4" />
                </Show>
              </button>
            )
          }}
        </For>
      </li>

      {/* Next Button */}
      <li
        class="ghost-btn gap-1.5 pl-2.5 pr-1.5 active:translate-y-px"
        onClick={nextPage}
      >
        <span>下一页</span>
        <div class="i-lucide:chevron-right text-4" />
      </li>
    </ul>
  )
}
