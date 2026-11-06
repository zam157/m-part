import type { PlaylistTracksOptions, Provider, ProviderName } from '../types/provider'
import { LoginRequiredError } from './providers/login-required'
import { EXTENSION_ID, getWebTransport, usesWebTransport, WEB_BRIDGE_PORT } from './web-transport'

// Only read-only operations cross the extension boundary. Pure URL and identity helpers stay local.
export const bridgeMethods = [
  'getTrackParts', 'getLyrics', 'getRecommendations', 'getSourceInfo', 'getCurrentUser',
  'getPlaylists', 'getPlaylist', 'getAllPlaylistTracks', 'search', 'searchArtist', 'searchAlbum',
  'searchPlaylist', 'getArtistInfo', 'getArtistWorks', 'getArtistAlbums', 'getAlbumWorks',
] as const satisfies readonly (keyof Provider)[]

export type BridgeMethod = typeof bridgeMethods[number]
export type BridgeRequest =
  | { type: 'ping' }
  | { type: 'provider', source: ProviderName, method: BridgeMethod, args: unknown[] }
  | { type: 'media', url: string }
export type BridgeReply =
  | { type: 'result', value: unknown }
  | { type: 'error', message: string, loginRequired?: boolean }
  | { type: 'progress', value: Parameters<NonNullable<PlaylistTracksOptions['onProgress']>>[0] }
  | { type: 'media', status: number, headers: [string, string][] }
  | { type: 'chunk', data: string }

interface BridgePort {
  postMessage: (request: BridgeRequest) => void
  disconnect: () => void
  onMessage: { addListener: (callback: (reply: BridgeReply) => void) => void }
  onDisconnect: { addListener: (callback: () => void) => void }
}

function bridgeUnavailable() {
  return new Error('无法连接 m-part 扩展，请安装或更新扩展，并确认当前网页地址已获允许')
}

function bridgeRequest(request: BridgeRequest, options?: { signal?: AbortSignal, onMessage?: (reply: BridgeReply) => void }): Promise<unknown> {
  const signal = options?.signal
  signal?.throwIfAborted()
  const runtime = (globalThis as typeof globalThis & { chrome?: { runtime?: { connect?: (id: string, options: { name: string }) => BridgePort } } }).chrome?.runtime
  if (!runtime?.connect) return Promise.reject(bridgeUnavailable())
  return new Promise((resolve, reject) => {
    let port: BridgePort
    try { port = runtime.connect!(EXTENSION_ID, { name: WEB_BRIDGE_PORT }) }
    catch { reject(bridgeUnavailable()); return }
    const finish = () => {
      clearTimeout(timeout)
      signal?.removeEventListener('abort', abort)
      port.disconnect()
    }
    const abort = () => { finish(); reject(signal?.reason) }
    const timeout = setTimeout(() => { finish(); reject(new Error('扩展取源超时，请重试')) }, request.type === 'ping' ? 3000 : 120_000)
    signal?.addEventListener('abort', abort, { once: true })
    port.onDisconnect.addListener(() => {
      // Reading lastError prevents Chrome from logging expected missing-extension errors.
      void (runtime as { lastError?: unknown }).lastError
      finish()
      reject(bridgeUnavailable())
    })
    port.onMessage.addListener((reply) => {
      if (reply.type === 'error') {
        finish()
        reject(reply.loginRequired ? new LoginRequiredError(reply.message) : new Error(reply.message))
      }
      else if (reply.type === 'result') { finish(); resolve(reply.value) }
      else {
        try { options?.onMessage?.(reply) }
        catch (error) { finish(); reject(error) }
      }
    })
    try { port.postMessage(request) }
    catch { finish(); reject(bridgeUnavailable()) }
  })
}

export async function checkWebExtension() {
  await bridgeRequest({ type: 'ping' })
}

export function withWebBridge(provider: Provider): Provider {
  if (!usesWebTransport()) return provider
  const wrapped = { ...provider }
  for (const method of bridgeMethods) {
    const call = provider[method] as ((...args: any[]) => Promise<unknown>) | undefined
    if (!call) continue
    Object.assign(wrapped, {
      [method](...args: unknown[]) {
        if (getWebTransport() !== 'extension') return call.apply(provider, args)
        const hasOptions = method === 'getTrackParts' || method === 'getLyrics' || method === 'getAllPlaylistTracks'
        const options = hasOptions ? args[1] as PlaylistTracksOptions | undefined : undefined
        const payload = hasOptions ? args.slice(0, 1) : args
        if (method === 'getAllPlaylistTracks') payload.push(options?.knownItems)
        return bridgeRequest({ type: 'provider', source: provider.name, method, args: payload }, {
          signal: options?.signal,
          onMessage: (reply) => { if (reply.type === 'progress') options?.onProgress?.(reply.value) },
        })
      },
    })
  }
  return wrapped
}

export async function fetchBridgeMedia(url: string, signal?: AbortSignal) {
  let metadata: Extract<BridgeReply, { type: 'media' }> | undefined
  const chunks: Uint8Array<ArrayBuffer>[] = []
  await bridgeRequest({ type: 'media', url }, {
    signal,
    onMessage: (reply) => {
      if (reply.type === 'media') metadata = reply
      if (reply.type === 'chunk') chunks.push(Uint8Array.from(atob(reply.data), char => char.charCodeAt(0)))
    },
  })
  if (!metadata) throw new Error('扩展未返回有效的音频')
  return new Response(new Blob(chunks), { status: metadata.status, headers: metadata.headers })
}
