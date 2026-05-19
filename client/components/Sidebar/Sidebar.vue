<script setup lang="ts">
const router = useRouter()

const menuItems = [
  {
    icon: 'i-solar:magnifer-linear',
    label: 'Search',
    route: '/search',
  },
  {
    icon: 'i-solar:lightbulb-bolt-linear',
    label: 'Playground',
    route: '/playground',
  },
]
</script>

<template>
  <div
    class="
      w-54 flex flex-col of-hidden
      gap-0.5 bg-sidebar text-sidebar-foreground grow-0 shrink-0
      border-r border-sidebar-border
    "
  >
    <div class="flex flex-col gap-1 p-2">
      <div
        class="btn flex w-full items-center gap-2 p-2 text-left h-12 text-sm"
        :class="{
          'bg-accent text-accent-foreground': router.currentRoute.value.path === '/',
        }"
        @click="() => router.push('/')"
      >
        <div class="i-solar:music-library-2-bold flex aspect-square text-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground" />
        <div class="w-full truncate font-semibold">
          Music Party
        </div>
      </div>
      <div v-for="(item, index) in menuItems" :key="index" class="flex min-h-0 flex-1 flex-col gap-2 overflow-auto">
        <div
          class="btn w-full p-2 flex justify-start gap-2" :class="{
            'bg-accent text-accent-foreground': router.currentRoute.value.path === item.route,
          }" @click="() => router.push(item.route)"
        >
          <div :class="item.icon" class="grow-0 shrink-0" />
          <span class="flex-1 truncate">{{ item.label }}</span>
        </div>
      </div>
    </div>
  </div>
</template>
