<script setup lang="ts">
interface Props {
  total: number
  pageSize?: number
  siblingCount?: number
}
const props = withDefaults(defineProps<Props>(), {
  pageSize: 20,
  siblingCount: 1,
})
const emit = defineEmits<{
  pageChange: [page: number]
}>()

const currentPage = defineModel<number>({ default: 1 })

const totalPages = computed(() => Math.ceil(props.total / props.pageSize))

const displayPages = computed(() => {
  const pages: (number | string)[] = []
  const { siblingCount } = props
  const maxPages = 2 * siblingCount + 5 // Left dots + siblings + page + siblings + right dots

  if (totalPages.value <= maxPages) {
    // Show all pages if total is small
    return Array.from({ length: totalPages.value }, (_, i) => i + 1)
  }

  // Always show first page
  pages.push(1)

  const leftSibling = Math.max(currentPage.value - siblingCount, 2)
  const rightSibling = Math.min(currentPage.value + siblingCount, totalPages.value - 1)

  // Add left ellipsis if needed
  if (leftSibling > 2)
    pages.push('...')

  // Add sibling pages
  for (let i = leftSibling; i <= rightSibling; i++)
    pages.push(i)

  // Add right ellipsis if needed
  if (rightSibling < totalPages.value - 1)
    pages.push('...')

  // Always show last page
  pages.push(totalPages.value)

  return pages
})

function goToPage(page: number) {
  if (page >= 1 && page <= totalPages.value && page !== currentPage.value) {
    currentPage.value = page
    emit('pageChange', page)
  }
}

function previousPage() {
  if (currentPage.value > 1) {
    const newPage = currentPage.value - 1
    goToPage(newPage)
    emit('pageChange', newPage)
  }
}

function nextPage() {
  if (currentPage.value < totalPages.value) {
    const newPage = currentPage.value + 1
    goToPage(newPage)
    emit('pageChange', newPage)
  }
}
</script>

<template>
  <ul class="flex items-center justify-center gap-1">
    <!-- Previous Button -->
    <li
      class="ghost-btn gap-1.5 pr-2.5 pl-1.5 active:translate-y-px"
      @click="previousPage"
    >
      <div class="i-lucide:chevron-left text-4" />
      <span>Previous</span>
    </li>

    <!-- Page Numbers -->
    <li class="flex items-center gap-1">
      <button
        v-for="(page, index) in displayPages"
        :key="index"
        class="w-8 h-8 p-0 flex items-center justify-center"
        :class="{
          'border-btn': page === currentPage,
          'ghost-btn active:translate-y-px': page !== currentPage && page !== '...',
        }"
        @click="() => {
          if (typeof page === 'number')
            goToPage(page)
        }"
      >
        <div v-if="page === '...'" class="i-lucide:ellipsis text-4" />
        <template v-else>
          {{ page }}
        </template>
      </button>
    </li>

    <!-- Next Button -->
    <li
      class="ghost-btn gap-1.5 pl-2.5 pr-1.5 active:translate-y-px"
      @click="nextPage"
    >
      <span>Next</span>
      <div class="i-lucide:chevron-right text-4" />
    </li>
  </ul>
</template>
