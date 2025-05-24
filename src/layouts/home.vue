<template>
  <main
    px-4 py-10
    text="center gray-700 dark:gray-200"
  >
    <RouterView />
    <div class="text-sm mx-auto mt-5 text-center opacity-50" @click="toggleDark()">
      [Home Layout]
    </div>
  </main>
</template>
