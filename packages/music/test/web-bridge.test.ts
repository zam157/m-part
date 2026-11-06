import { Blob } from 'node:buffer'
import { afterEach, expect, it, vi } from 'vitest'
import type { Provider } from '../src/types/provider'
import type { BridgeReply, BridgeRequest } from '../src/utils/web-bridge'
import { getClientSessionCookie, setClientCookie, setClientCookieMode } from '../src/utils/client-cookies'
import { fetchBridgeMedia, withWebBridge } from '../src/utils/web-bridge'
import { EXTENSION_ID, setWebTransport, WEB_BRIDGE_PORT } from '../src/utils/web-transport'

function stubBridge(onRequest: (request: BridgeRequest, reply: (message: BridgeReply) => void) => void) {
  let respond: (message: BridgeReply) => void
  const port = {
    onMessage: { addListener: (listener: typeof respond) => { respond = listener } },
    onDisconnect: { addListener: vi.fn() },
    postMessage: vi.fn((request: BridgeRequest) => onRequest(request, respond)),
    disconnect: vi.fn(),
  }
  const connect = vi.fn(() => port)
  vi.stubGlobal('chrome', { runtime: { connect } })
  return { port, connect }
}

afterEach(() => {
  localStorage.clear()
  vi.unstubAllGlobals()
})

it('sends only Provider arguments, relays progress, and closes the extension port', async () => {
  const provider: Provider = { name: 'netease', getAllPlaylistTracks: vi.fn().mockResolvedValue([]) }
  const progress = vi.fn()
  const { port, connect } = stubBridge((_request, reply) => {
    reply({ type: 'progress', value: { total: 20, items: [] } })
    reply({ type: 'result', value: [] })
  })
  setWebTransport('extension')
  await expect(withWebBridge(provider).getAllPlaylistTracks!('123', { signal: new AbortController().signal, knownItems: [], onProgress: progress })).resolves.toEqual([])
  expect(connect).toHaveBeenCalledWith(EXTENSION_ID, { name: WEB_BRIDGE_PORT })
  expect(port.postMessage).toHaveBeenCalledWith({ type: 'provider', source: 'netease', method: 'getAllPlaylistTracks', args: ['123', []] })
  expect(progress).toHaveBeenCalledWith({ total: 20, items: [] })
  expect(port.disconnect).toHaveBeenCalledOnce()
  expect(provider.getAllPlaylistTracks).not.toHaveBeenCalled()
})

it('disconnects the extension media request when a track is cancelled', async () => {
  const controller = new AbortController()
  const { port } = stubBridge(() => {})
  const result = fetchBridgeMedia('https://m10.music.126.net/audio.mp3', controller.signal)
  controller.abort()
  await expect(result).rejects.toMatchObject({ name: 'AbortError' })
  expect(port.disconnect).toHaveBeenCalledOnce()
})

it('sends only the active manual Cookie and keeps website sessions local to the extension', async () => {
  const provider = withWebBridge({ name: 'bili', getCurrentUser: async () => null })
  const { port } = stubBridge((_request, reply) => reply({ type: 'result', value: null }))
  setWebTransport('extension')
  await setClientCookie('bili', 'SESSDATA=test-manual; extra=not-for-room')
  await setClientCookieMode('bili', 'manual')
  await provider.getCurrentUser!()
  expect(port.postMessage).toHaveBeenLastCalledWith({ type: 'provider-manual', source: 'bili', method: 'getCurrentUser', args: [], cookie: 'SESSDATA=test-manual; extra=not-for-room' })
  expect(await getClientSessionCookie('bili')).toBe('SESSDATA=test-manual')
  await setClientCookieMode('bili', 'website')
  await provider.getCurrentUser!()
  expect(port.postMessage).toHaveBeenLastCalledWith({ type: 'provider', source: 'bili', method: 'getCurrentUser', args: [] })
  expect(await getClientSessionCookie('bili')).toBe('')
})

it('discards a reply from an earlier Cookie selection', async () => {
  let respond!: (reply: BridgeReply) => void
  stubBridge((_request, reply) => { respond = reply })
  const provider = withWebBridge({ name: 'bili', getCurrentUser: async () => null })
  setWebTransport('extension')
  await setClientCookie('bili', 'SESSDATA=test')
  await setClientCookieMode('bili', 'manual')
  const result = provider.getCurrentUser!()
  await setClientCookieMode('bili', 'website')
  respond({ type: 'result', value: { id: 'old-session' } })
  await expect(result).rejects.toThrow('音源 Cookie 已更新')
})

it('reassembles binary chunks into the original media payload', async () => {
  vi.stubGlobal('Blob', Blob)
  stubBridge((_request, reply) => {
    reply({ type: 'media', status: 200, headers: [['content-type', 'audio/mpeg']] })
    reply({ type: 'chunk', data: btoa('one') })
    reply({ type: 'chunk', data: btoa('two') })
    reply({ type: 'result', value: null })
  })
  const response = await fetchBridgeMedia('https://m10.music.126.net/audio.mp3')
  expect(response.headers.get('content-type')).toBe('audio/mpeg')
  expect(await response.text()).toBe('onetwo')
})
