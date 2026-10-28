import { createComponent, render } from '@solidjs/web'
import { flush } from 'solid-js'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import PlaylistDetailPage from '~/pages/playlist-detail/[provider]/[id]'
import { setRoomControlsWritable, setRoomPlayerHandler } from '~/composables/player-context'

const { page, all, insert, replace } = vi.hoisted(() => ({ page: vi.fn(), all: vi.fn(), insert: vi.fn(), replace: vi.fn() }))
vi.mock('@solidjs/router', () => ({ useNavigate: () => vi.fn(), useParams: () => ({ provider: 'netease', id: 'list' }), useSearchParams: () => [{}] }))
vi.mock('@m-part/music/providers', () => ({ providers: { netease: { getPlaylist: page, getAllPlaylistTracks: all } } }))
vi.mock('~/composables/player', () => ({ addToPlayQueue: vi.fn(), addNextToPlayQueue: vi.fn(), currentSong: () => null, openTrackParts: vi.fn(), setPlayQueue: replace, addTracksToPlayQueue: insert }))
const song = (id: string) => ({ provider: 'netease' as const, id, title: id, duration: 100, coverUrl: '' })
let container: HTMLDivElement
let dispose: () => void
const tick = async () => { for (let i = 0; i < 10; i++) await Promise.resolve(); flush() }
const button = (title: string) => [...container.querySelectorAll('button')].find(item => item.textContent?.trim() === title)!
beforeEach(async () => {
  page.mockReset().mockResolvedValue({ items: [song('a')], hasMore: true })
  all.mockReset().mockResolvedValue([song('a'), song('b'), song('a')])
  insert.mockReset().mockResolvedValue(undefined); replace.mockReset().mockResolvedValue(undefined)
  setRoomPlayerHandler(); flush()
  container = document.createElement('div'); document.body.append(container)
  dispose = render(() => createComponent(PlaylistDetailPage, {}), container)
  await tick()
})
afterEach(() => { dispose(); container.remove(); setRoomPlayerHandler(); flush() })

it('loads the complete playlist before inserting it after the current track, without replacing the queue', async () => {
  let finish!: (value: ReturnType<typeof song>[]) => void
  all.mockImplementationOnce(() => new Promise(resolve => { finish = resolve }))
  button('添加至播放列表').click(); await tick()
  expect(insert).not.toHaveBeenCalled(); expect(replace).not.toHaveBeenCalled()
  finish([song('a'), song('b'), song('a')]); await tick()
  expect(insert).toHaveBeenCalledExactlyOnceWith([song('a'), song('b')], 'next')
  expect(replace).not.toHaveBeenCalled()
})
it('retries a failed insert action as an insert, preserving the existing queue on failure', async () => {
  all.mockRejectedValueOnce(new Error('歌单读取失败'))
  button('添加至播放列表').click(); await tick()
  expect(container.textContent).toContain('歌单读取失败')
  expect(insert).not.toHaveBeenCalled(); expect(replace).not.toHaveBeenCalled()
  button('重试').click(); await tick()
  expect(insert).toHaveBeenCalledWith([song('a'), song('b')], 'next')
  expect(replace).not.toHaveBeenCalled()
})
it('retains one-click playback as a queue replacement', async () => {
  button('一键播放').click(); await tick()
  expect(replace).toHaveBeenCalledWith([song('a'), song('b')])
  expect(insert).not.toHaveBeenCalled()
})
it('discards a loaded playlist after the playback context changes', async () => {
  let finish!: (value: ReturnType<typeof song>[]) => void
  all.mockImplementationOnce(() => new Promise(resolve => { finish = resolve }))
  button('添加至播放列表').click(); await tick()
  setRoomPlayerHandler(vi.fn()); setRoomControlsWritable(true); flush()
  finish([song('a'), song('b')]); await tick()
  expect(insert).not.toHaveBeenCalled(); expect(replace).not.toHaveBeenCalled()
})
