import { createComponent, render } from '@solidjs/web'
import { createSignal, flush } from 'solid-js'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'

const { load } = vi.hoisted(() => ({ load: vi.fn() }))
const [view, setView] = createSignal<'local' | 'platform'>('local')
vi.mock('@solidjs/router', () => ({ useNavigate: () => vi.fn() }))
vi.mock('~/composables/playlists', () => ({
  playlistView: () => view(), setPlaylistView: (next: 'local' | 'platform') => setView(next),
  playlistSource: () => 'bili', setPlaylistSource: vi.fn(), loadPlaylists: load,
  playlistLibrary: () => ({ source: 'bili', loaded: true, loading: false, error: null, user: null, items: [], hasMore: false }),
}))
vi.mock('~/components/LocalPlaylists/LocalPlaylists', () => ({ default: () => '本地列表内容' }))
vi.mock('~/components/PlatformLogin/PlatformLogin', () => ({
  default: () => '平台登录内容', platformOptions: [{ value: 'bili', label: 'BiliBili' }],
}))
import PlaylistsPage from '~/pages/playlists'

let dispose: () => void
let container: HTMLDivElement
beforeEach(() => {
  load.mockReset().mockResolvedValue(undefined); setView('local'); flush()
  container = document.createElement('div'); document.body.append(container)
})
afterEach(() => { dispose(); container.remove() })
function mount() { dispose = render(() => createComponent(PlaylistsPage, {}), container); flush() }
const tab = (name: string) => [...container.querySelectorAll<HTMLButtonElement>('[role="tab"]')].find(button => button.textContent === name)!

it('uses shared tab panels and only loads platform data when the platform tab is activated', () => {
  mount()
  expect(container.querySelector('[role="tablist"]')?.getAttribute('aria-label')).toBe('歌单类型')
  expect(container.textContent).toContain('本地列表内容')
  expect(load).not.toHaveBeenCalled()
  tab('平台歌单').click(); flush()
  expect(view()).toBe('platform')
  expect(load).toHaveBeenCalledExactlyOnceWith('bili')
  expect(container.textContent).not.toContain('本地列表内容')
  expect(container.textContent).toContain('平台登录内容')
  expect(document.getElementById(tab('本地歌单').getAttribute('aria-controls')!)?.hidden).toBe(true)
  tab('本地歌单').click(); flush()
  expect(view()).toBe('local')
  expect(load).toHaveBeenCalledTimes(1)
})

it('moves focus with arrow keys without loading data until Enter activates the tab', () => {
  mount()
  tab('本地歌单').focus()
  tab('本地歌单').dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, cancelable: true })); flush()
  expect(document.activeElement).toBe(tab('平台歌单'))
  expect(view()).toBe('local')
  expect(load).not.toHaveBeenCalled()
  tab('平台歌单').dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true })); flush()
  expect(view()).toBe('platform')
  expect(load).toHaveBeenCalledExactlyOnceWith('bili')
})

it('restores and follows the existing module-level playlist view', () => {
  setView('platform'); flush(); mount()
  expect(tab('平台歌单').getAttribute('aria-selected')).toBe('true')
  expect(load).toHaveBeenCalledExactlyOnceWith('bili')
  setView('local'); flush()
  expect(tab('本地歌单').getAttribute('aria-selected')).toBe('true')
  expect(container.textContent).toContain('本地列表内容')
})
