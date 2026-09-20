/* eslint-disable no-console */
import { wait } from '#shared/utils/index'
import biliProvider from '#shared/utils/providers/bilibili'
import Popover from '~/components/Popover/Popover'
import { colorMode, switchColorMode } from '~/composables/dark'
import { setCurrentIndex, setPlaying, setPlayQueue } from '~/composables/player'

function toggleDark() {
  if (colorMode() === 'light') {
    switchColorMode('dark')
  }
  else if (colorMode() === 'dark') {
    switchColorMode('system')
  }
  else if (colorMode() === 'system') {
    switchColorMode('light')
  }
}

async function setMockedPlayQueue() {
  setPlayQueue([
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
  const results = await biliProvider.search('一条闲木鱼', 1)
  console.log('Bili Search Results:', results)
  await wait(2357)
  const sourceInfo = await biliProvider.getSourceInfo?.(results[0][0]!)
  console.log('Source Info:', sourceInfo)
}

export default function Playground() {
  return (
    <div class="flex-1 min-w-0">
      <div class="ghost-btn px-3 py-2" onClick={toggleDark}>
        colorMode:
        {' '}
        {colorMode()}
      </div>
      <div class="ghost-btn px-3 py-2" onClick={setMockedPlayQueue}>
        Set Mocked Play Queue
      </div>
      <div class="ghost-btn px-3 py-2" onClick={biliSearch}>
        Bili Search
      </div>
      <Popover
        triggerAttrs={{ class: 'ghost-btn px-3 py-2' }}
        trigger="Popover Test"
        content={<p>This is the popover content.</p>}
      />
    </div>
  )
}
