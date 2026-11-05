import { createComponent, render } from '@solidjs/web'
import { createSignal, flush } from 'solid-js'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import type { LocalPlaylistDialogRequest } from '~/composables/local-playlists'
import { mockDialog } from '../helpers/dialog'

const { create, load } = vi.hoisted(() => ({ create: vi.fn(), load: vi.fn() }))
const [request, setRequest] = createSignal<LocalPlaylistDialogRequest | null>(null)
vi.mock('~/composables/local-playlists', () => ({
  localPlaylistDialog: () => request(), setLocalPlaylistDialog: (value: LocalPlaylistDialogRequest | null) => setRequest(value),
  localPlaylists: { load, create, state: () => ({ loaded: true, loading: false, error: '', items: [] }) },
  addMusicToLocalPlaylist: vi.fn(),
}))
import LocalPlaylistDialog from '~/components/LocalPlaylistDialog/LocalPlaylistDialog'

let dispose: () => void
let container: HTMLDivElement
let restore: () => void
beforeEach(() => {
  restore = mockDialog(); create.mockReset().mockResolvedValue(undefined); load.mockReset().mockResolvedValue(undefined)
  setRequest({ kind: 'create' }); flush()
  container = document.createElement('div'); document.body.append(container)
  dispose = render(() => createComponent(LocalPlaylistDialog, {}), container); flush()
})
afterEach(() => { dispose(); container.remove(); restore(); setRequest(null); flush() })

it('submits the named playlist through the shared dialog footer and closes after success', async () => {
  const dialog = container.querySelector('dialog')!
  expect(dialog.open).toBe(true)
  const input = dialog.querySelector('input')!
  input.value = '旅行'; input.dispatchEvent(new Event('input', { bubbles: true })); flush()
  dialog.querySelector<HTMLButtonElement>('footer button[type="submit"]')!.click()
  await Promise.resolve(); await Promise.resolve(); flush()
  expect(create).toHaveBeenCalledExactlyOnceWith('旅行', [])
  expect(request()).toBeNull()
  expect(dialog.open).toBe(false)
})

it('closes through the shared header without creating a playlist', () => {
  container.querySelector<HTMLButtonElement>('[aria-label="关闭本地歌单弹窗"]')!.click(); flush()
  expect(request()).toBeNull()
  expect(create).not.toHaveBeenCalled()
})
