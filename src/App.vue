<script setup lang="ts">
// https://github.com/vueuse/head
// you can use this to manipulate the document head in any components,
// they will be rendered correctly in the html results with vite-ssg
// useHead({
//   title: 'm-part',
//   meta: [
//     {
//       name: 'description',
//       content: 'Music Party ~',
//     },
//     {
//       name: 'theme-color',
//       content: () => isDark.value ? '#00aba9' : '#ffffff',
//     },
//   ],
//   link: [
//     {
//       rel: 'icon',
//       type: 'image/svg+xml',
//       href: () => preferredDark.value ? '/favicon-dark.svg' : '/favicon.svg',
//     },
//   ],
// })
</script>

<template>
  <main class="text-gray-700 px-4 py-10 text-center dark:text-gray-200">
    <RouterView />
  </main>
</template>
