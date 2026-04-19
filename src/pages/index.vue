<script setup lang="ts">
import { colorMode, switchColorMode } from '~/composables/dark'
import { setCurrentIndex, setPlaylist } from '~/composables/player'

defineOptions({
  name: 'IndexPage',
})

function toggleDark() {
  switchColorMode(colorMode.value === 'light' ? 'dark' : 'light')
}

function setMockedPlaylist() {
  setPlaylist([
    {
      name: 'Paza Moduless',
      artist: 'HYONNA',
      album: {
        name: 'Chaff & Dust',
        cover: '',
      },
      src: '/songs/paza-moduless.mp3',
    },
    {
      name: 'Die For You',
      artist: 'Riot Music',
      album: {
        name: 'Chaff & Dust',
        cover: '',
      },
      src: '/songs/die-for-you.mp3',
    },
    {
      name: 'Test Song Without Source',
      artist: 'Unknown Artist',
      album: {
        name: 'Unknown Album',
        cover: '',
      },
      src: '/songs/non-existent-file.mp3',
    },
  ])
  setCurrentIndex(0, true)
}
</script>

<template>
  <div class="flex-1 min-w-0">
    <div class="btn px-3 py-2" @click="toggleDark">
      colorMode: {{ colorMode }}
    </div>
    <div class="btn px-3 py-2" @click="setMockedPlaylist">
      Set Mocked Playlist
    </div>
  </div>
</template>
