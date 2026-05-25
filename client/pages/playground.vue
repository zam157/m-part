<script setup lang="ts">
/* eslint-disable no-console */
import { wait } from '#shared/utils/index'
import biliProvider from '#shared/utils/providers/bilibili'
import Popover from '~/components/Popover/Popover.vue'
import { colorMode, switchColorMode } from '~/composables/dark'
import { setCurrentIndex, setPlaying, setPlaylist } from '~/composables/player'

defineOptions({
  name: 'Playground',
})

function toggleDark() {
  if (colorMode.value === 'light') {
    switchColorMode('dark')
  }
  else if (colorMode.value === 'dark') {
    switchColorMode('system')
  }
  else if (colorMode.value === 'system') {
    switchColorMode('light')
  }
}

async function setMockedPlaylist() {
  setPlaylist([
    {
      provider: 'bili',
      id: 'BV1kPQjBLE1q',
      title: 'Song 1',
      artist: 'Artist A',
      duration: 1992,
      coverUrl: 'http://i2.hdslb.com/bfs/archive/e4b39b75b141e15ec5eb197b92b8e3f9e768a609.jpg',
      album: '',
    },
    {
      provider: 'bili',
      id: 'BV1QNdQBKEhU',
      title: 'Song 2',
      artist: 'Artist B',
      duration: 1992,
      coverUrl: 'http://i2.hdslb.com/bfs/archive/e4b39b75b141e15ec5eb197b92b8e3f9e768a609.jpg',
      album: '',
    },
    {
      provider: 'bili',
      id: 'BV1vK4y1p7F5',
      title: 'Song 3',
      artist: 'Artist C',
      duration: 1992,
      coverUrl: 'http://i2.hdslb.com/bfs/archive/e4b39b75b141e15ec5eb197b92b8e3f9e768a609.jpg',
      album: '',
    },
  ])
  await setCurrentIndex(0)
  setPlaying(true)
}

async function biliSearch() {
  const results = await biliProvider.search('一条闲木鱼', 1, 'music')
  console.log('Bili Search Results:', results)
  await wait(2357)
  const sourceInfo = await biliProvider.getSourceInfo?.(results[0][0]!)
  console.log('Source Info:', sourceInfo)
}
</script>

<template>
  <div class="flex-1 min-w-0">
    <div class="ghost-btn px-3 py-2" @click="toggleDark">
      colorMode: {{ colorMode }}
    </div>
    <div class="ghost-btn px-3 py-2" @click="setMockedPlaylist">
      Set Mocked Playlist
    </div>
    <div class="ghost-btn px-3 py-2" @click="biliSearch">
      Bili Search
    </div>
    <Popover :triggerAttrs="{ class: 'ghost-btn px-3 py-2' }">
      <template #trigger>
        Popover Test
      </template>
      <template #content>
        <p>This is the popover content.</p>
      </template>
    </Popover>
  </div>
</template>
