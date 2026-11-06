import type { BridgeMethod, BridgeReply, BridgeRequest } from '@m-part/music/web-bridge'
import type { Provider } from '@m-part/music/types/provider'
import { bridgeMethods } from '@m-part/music/web-bridge'
import { WEB_BRIDGE_PORT } from '@m-part/music/web-transport'
import { isMediaContentType, mediaResponseHeaders, providerMedia } from '@m-part/music/provider-request'
import { LoginRequiredError } from '@m-part/music/providers/login-required'
import { providers } from '@m-part/music/providers'

const allowedOrigins = new Set(import.meta.env.VITE_WEB_BRIDGE_ORIGINS?.split(',') ?? [])
const MEDIA_LIMIT = 128 * 1024 * 1024
const CHUNK_SIZE = 32 * 1024

async function relayMedia(url: string, signal: AbortSignal, send: (reply: BridgeReply) => void) {
  const target = providerMedia(url)
  if (!target) throw new Error('扩展不支持此音频地址')
  const response = await fetch(target.url, { credentials: 'omit', redirect: 'error', signal })
  if (response.status !== 200 || !response.body || !isMediaContentType(response.headers)) {
    await response.body?.cancel()
    throw new Error(`扩展音频请求失败（HTTP ${response.status}）`)
  }
  if (Number(response.headers.get('content-length')) > MEDIA_LIMIT) {
    await response.body.cancel()
    throw new Error('音频超过扩展传输上限，请使用代理服务')
  }
  const headers = mediaResponseHeaders(response.headers)
  headers.delete('content-length')
  send({ type: 'media', status: response.status, headers: [...headers] })
  const reader = response.body.getReader()
  let total = 0
  try {
    for (;;) {
      const { value, done } = await reader.read()
      if (done) break
      signal.throwIfAborted()
      total += value.byteLength
      if (total > MEDIA_LIMIT) throw new Error('音频超过扩展传输上限，请使用代理服务')
      for (let offset = 0; offset < value.length; offset += CHUNK_SIZE) {
        const chunk = value.subarray(offset, offset + CHUNK_SIZE)
        send({ type: 'chunk', data: btoa(String.fromCharCode(...chunk)) })
      }
    }
  }
  finally { await reader.cancel().catch(() => {}) }
}

function providerCall(provider: Provider, method: BridgeMethod, args: unknown[], signal: AbortSignal, send: (reply: BridgeReply) => void) {
  const call = provider[method] as ((...args: any[]) => Promise<unknown>) | undefined
  if (!call) throw new Error('该音源不支持此操作')
  if (method === 'getTrackParts' || method === 'getLyrics') return call.call(provider, args[0], { signal })
  if (method === 'getAllPlaylistTracks') {
    return call.call(provider, args[0], { signal, knownItems: args[1], onProgress: (value: Extract<BridgeReply, { type: 'progress' }>['value']) => send({ type: 'progress', value }) })
  }
  return call.apply(provider, args)
}

export function registerWebBridge() {
  chrome.runtime.onConnectExternal.addListener((port) => {
    const sender = port.sender
    if (port.name !== WEB_BRIDGE_PORT || sender?.frameId !== 0 || !sender.origin || !allowedOrigins.has(sender.origin)) {
      port.disconnect()
      return
    }

    const controller = new AbortController()
    const send = (reply: BridgeReply) => { if (!controller.signal.aborted) port.postMessage(reply) }
    const disconnect = () => controller.abort()
    port.onDisconnect.addListener(disconnect)
    const handleRequest = async (message: BridgeRequest) => {
      port.onMessage.removeListener(handleRequest)
      try {
        if (message?.type === 'ping') send({ type: 'result', value: true })
        else if (message?.type === 'media' && typeof message.url === 'string') {
          await relayMedia(message.url, controller.signal, send)
          send({ type: 'result', value: null })
        }
        else if (message?.type === 'provider' && Object.hasOwn(providers, message.source) && bridgeMethods.includes(message.method) && Array.isArray(message.args) && message.args.length <= 3) {
          const value = await providerCall(providers[message.source], message.method, message.args, controller.signal, send)
          send({ type: 'result', value })
        }
        else send({ type: 'error', message: '扩展收到不支持的取源请求' })
      }
      catch (error) {
        if (error instanceof LoginRequiredError) send({ type: 'error', message: error.message, loginRequired: true })
        else send({ type: 'error', message: error instanceof Error && !(error instanceof TypeError) ? error.message.slice(0, 300) : '扩展请求音源失败，请重试' })
      }
    }
    port.onMessage.addListener(handleRequest)
  })
}
