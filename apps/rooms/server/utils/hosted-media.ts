import type { HostedPlatform, RoomControl, RoomSnapshot } from '@m-part/listen-core/protocol'
import type { HostedProvider, HostedProviders, HostedResource } from '../providers/shared'
import { randomBytes } from 'node:crypto'
import { HostedSourceError } from '../providers/shared'
import type { ListenRooms } from './listen-rooms'

const LEASE_MS = 120_000
const MAX_RESPONSE_BYTES = 64 * 1024 * 1024
interface Credential { provider: HostedPlatform, cookie: string, ownerId: string, label: string }
interface Resource {
  provider: HostedProvider, platform: HostedPlatform, source: HostedResource, roomId: string, version: number, playbackId: string, trackId: string,
  controller: AbortController, refreshing?: Promise<void>, streams: Set<AbortController>,
}
interface Ticket {
  id: string, token: string, memberId: string, generation: number, roomId: string,
  expires: number, resource: Resource, streams: Set<AbortController>,
}

/** Private, bounded in-memory sessions, source resolution and revocable media leases. */
export class HostedMedia {
  private credentials = new Map<string, Partial<Record<HostedPlatform, Credential>>>()
  private states = new Map<string, RoomSnapshot>()
  private resources = new Map<string, Promise<Resource>>()
  private resolving = new Map<string, AbortController>()
  private tickets = new Map<string, Ticket>()
  private pending = new Map<string, AbortController>()
  private requests = new Map<string, { at: number, count: number }>()
  private budgets = new Map<string, { at: number, bytes: number }>()
  private active = 0

  constructor(private rooms: ListenRooms, private providers: HostedProviders, private fetcher: typeof fetch = fetch, private now = () => performance.now()) {}

  /** Every authoritative broadcast invalidates old sources, connections and tickets. */
  sync(state: RoomSnapshot) {
    const old = this.states.get(state.roomId)
    const invalid = state.status === 'ended' || old?.source?.version !== state.source?.version || old?.playbackId !== state.playbackId || !!state.source?.error
    this.states.set(state.roomId, state)
    if (invalid) {
      const resource = this.resources.get(state.roomId)
      this.resolving.get(state.roomId)?.abort(); this.resolving.delete(state.roomId)
      this.resources.delete(state.roomId)
      void resource?.then(r => { r.controller.abort(); for (const stream of r.streams) stream.abort() }).catch(() => {})
    }
    for (const [id, ticket] of this.tickets) {
      const member = state.members.find(m => m.id === ticket.memberId)
      if ((ticket.roomId === state.roomId && (invalid || !member?.online || member.generation !== ticket.generation)) || ticket.expires <= this.now()) this.dropTicket(id)
    }
    if (state.status === 'ended') {
      this.credentials.delete(state.roomId)
      for (const [key, controller] of this.pending) if (key.startsWith(`${state.roomId}:`)) { controller.abort(); this.pending.delete(key) }
      this.states.delete(state.roomId); this.budgets.delete(state.roomId)
    }
    for (const [key, value] of this.requests) if (this.now() - value.at >= 60_000) this.requests.delete(key)
  }

  private dropTicket(id: string) {
    const ticket = this.tickets.get(id)
    this.tickets.delete(id)
    if (ticket) for (const stream of ticket.streams) stream.abort()
  }

  private limit(key: string, maximum: number) {
    const current = this.requests.get(key)
    const count = current && this.now() - current.at < 60_000 ? current : { at: this.now(), count: 0 }
    if (++count.count > maximum) throw new HostedSourceError('操作过于频繁，请稍后重试')
    if (this.requests.size > 2000) throw new HostedSourceError('房间服务繁忙，请稍后重试')
    this.requests.set(key, count)
  }

  async control(token: string, request: RoomControl, signal: AbortSignal) {
    const auth = this.rooms.authorize(token, request.roomId)
    this.limit(`${request.roomId}:${auth.memberId}:${request.action}:${'provider' in request ? request.provider ?? 'netease' : ''}`, request.action === 'credential' ? 3 : 30)
    if (request.action === 'ticket') return this.issue(token, auth, request, signal)
    if (request.action === 'renew') {
      const ticket = this.tickets.get(request.ticket)
      if (!ticket || ticket.token !== token) throw new HostedSourceError('媒体票据已失效，请恢复同步')
      this.validateTicket(ticket)
      ticket.expires = this.now() + LEASE_MS
      return { ticket: ticket.id, leaseMs: LEASE_MS }
    }
    if (!auth.isHost) throw new HostedSourceError('仅房主可管理房间音源')
    if (auth.snapshot.revision !== request.expectedRevision) throw new HostedSourceError('房间状态已更新，请重新操作')
    if (request.action === 'credential' || request.action === 'revoke') {
      const platform = request.provider ?? 'netease'
      const key = `${request.roomId}:${platform}`
      const name = { netease: '网易云', qq: 'QQ 音乐', bili: 'BiliBili' }[platform]
      this.pending.get(key)?.abort()
      const controller = new AbortController()
      this.pending.set(key, controller)
      try {
        const provider = this.providers[platform]
        const cookie = request.action === 'credential' ? provider.parseCookie(request.cookie) : ''
        const label = cookie ? await provider.validate(cookie, AbortSignal.any([signal, controller.signal])) : undefined
        signal.throwIfAborted(); controller.signal.throwIfAborted()
        const latest = this.rooms.authorize(token, request.roomId)
        if (!latest.isHost || latest.generation !== auth.generation || latest.snapshot.revision !== request.expectedRevision) throw new HostedSourceError('房间状态已更新，请重新操作')
        const source = latest.snapshot.source!
        const accounts = { ...source.accounts, [platform]: { credential: cookie ? 'ready' as const : 'none' as const, version: (source.accounts?.[platform]?.version ?? 0) + 1, ...(cookie ? { ownerId: auth.memberId, label } : {}) } }
        const affectsPlayback = source.mode === 'hosted' && source.provider === platform
        this.rooms.updateSource(token, request.roomId, request.expectedRevision, { accounts, ...(affectsPlayback ? { error: undefined } : {}) }, () => {
          const sessions = { ...this.credentials.get(request.roomId) }
          if (cookie) sessions[platform] = { provider: platform, cookie, label: label!, ownerId: auth.memberId }
          else delete sessions[platform]
          this.credentials.set(request.roomId, sessions)
          this.pending.delete(key)
        }, { affectsPlayback, operation: `${cookie ? '绑定' : '撤销'}了${name}房间账号` })
      }
      finally { if (this.pending.get(key) === controller) this.pending.delete(key) }
    }
    else {
      const mode = request.action === 'source' ? request.mode : auth.snapshot.source?.mode ?? 'independent'
      this.rooms.updateSource(token, request.roomId, request.expectedRevision, { mode, error: undefined })
    }
    return { ok: true, snapshot: this.rooms.authorize(token, request.roomId).snapshot }
  }

  private async issue(token: string, auth: ReturnType<ListenRooms['authorize']>, request: Extract<RoomControl, { action: 'ticket' }>, signal: AbortSignal) {
    const state = auth.snapshot
    const track = state.currentIndex === null ? undefined : state.queue[state.currentIndex]
    if (state.source?.mode !== 'hosted' || state.source.version !== request.sourceVersion || state.playbackId !== request.playbackId || track?.queueItemId !== request.queueItemId) throw new HostedSourceError('房间音源已更新，请恢复同步')
    if (state.source.error) throw new HostedSourceError(state.source.error)
    let pending = this.resources.get(state.roomId)
    if (!pending) {
      const controller = new AbortController()
      this.resolving.set(state.roomId, controller)
      pending = (async () => {
        try {
          const credential = this.credentials.get(state.roomId)?.[track.provider]
          const provider = this.providers[track.provider]
          const source = await provider.resolve(credential?.cookie ?? '', track.id, controller.signal)
          return { provider, platform: track.provider, source, controller, roomId: state.roomId, version: state.source!.version, playbackId: state.playbackId, trackId: track.id, streams: new Set<AbortController>() }
        }
        catch (error) { if (!controller.signal.aborted) this.fail(state.roomId, state.source!.version, state.playbackId, track.provider, error); throw error }
      })()
      this.resources.set(state.roomId, pending)
    }
    const resource = await pending
    signal.throwIfAborted()
    const latest = this.rooms.authorize(token, state.roomId)
    if (latest.generation !== auth.generation || resource.controller.signal.aborted || latest.snapshot.source?.version !== resource.version || latest.snapshot.playbackId !== resource.playbackId) throw new HostedSourceError('房间音源已更新，请重试')
    // Multiple range requests share one lease. Cap old leases for each member.
    const previous = [...this.tickets.values()].filter(t => t.roomId === state.roomId && t.memberId === auth.memberId)
    for (const old of previous.slice(0, Math.max(0, previous.length - 2))) this.dropTicket(old.id)
    if (this.tickets.size >= 1500) throw new HostedSourceError('媒体票据已达上限，请稍后重试')
    const id = randomBytes(32).toString('hex')
    this.tickets.set(id, { id, token, roomId: state.roomId, memberId: latest.memberId, generation: latest.generation, resource, streams: new Set(), expires: this.now() + LEASE_MS })
    return { ticket: id, leaseMs: LEASE_MS }
  }

  private validateTicket(ticket: Ticket) {
    const auth = this.rooms.authorize(ticket.token, ticket.roomId)
    const source = auth.snapshot.source
    if (ticket.expires <= this.now() || auth.generation !== ticket.generation || ticket.resource.controller.signal.aborted || source?.mode !== 'hosted' || source.version !== ticket.resource.version || source.error || auth.snapshot.playbackId !== ticket.resource.playbackId) throw new HostedSourceError('媒体票据已过期或被撤销')
    return auth
  }

  private fail(roomId: string, version: number, playbackId: string, platform: HostedPlatform, error: unknown) {
    const state = this.states.get(roomId)
    if (state?.source?.version !== version || state.playbackId !== playbackId || state.source.provider !== platform) return
    const safe = error instanceof HostedSourceError ? error : new HostedSourceError('房间音源请求失败，请房主重试或重新绑定账号')
    const sessions = this.credentials.get(roomId)
    const invalid = safe.invalidCredential && !!sessions?.[platform]
    if (invalid) delete sessions![platform]
    this.rooms.sourceFailed(roomId, version, safe.message, invalid)
  }

  private charge(roomId: string, bytes: number) {
    for (const [key, maximum] of [[roomId, 128 * 1024 * 1024], ['*', 512 * 1024 * 1024]] as const) {
      const old = this.budgets.get(key)
      const budget = old && this.now() - old.at < 60_000 ? old : { at: this.now(), bytes: 0 }
      budget.bytes += bytes
      this.budgets.set(key, budget)
      if (budget.bytes > maximum) throw new HostedSourceError('房间媒体流量已达上限，请稍后重试')
    }
  }

  private async upstream(resource: Resource, request: Request, signal: AbortSignal) {
    let url = resource.source.url
    for (let hop = 0; hop < 4; hop++) {
      const headers = new Headers({ ...resource.provider.mediaHeaders, 'accept-encoding': 'identity' })
      const range = request.headers.get('range')
      if (range) headers.set('range', range)
      const timeout = new AbortController()
      const timer = setTimeout(() => timeout.abort(), 15_000)
      let result: Response
      try { result = await this.fetcher(resource.provider.validateMediaUrl(url), { method: request.method, headers, signal: AbortSignal.any([signal, timeout.signal]), redirect: 'manual', credentials: 'omit' }) }
      finally { clearTimeout(timer) }
      if (![301, 302, 303, 307, 308].includes(result.status)) return result
      const location = result.headers.get('location')
      await result.body?.cancel()
      if (!location) throw new HostedSourceError('房间音源跳转无效')
      url = resource.provider.validateMediaUrl(new URL(location, url).href)
    }
    throw new HostedSourceError('房间音源跳转次数过多')
  }

  async audio(request: Request, id: string) {
    const ticket = this.tickets.get(id)
    if (!ticket) return new Response(null, { status: 401 })
    let resource: Resource
    try { this.validateTicket(ticket); resource = ticket.resource }
    catch { this.dropTicket(id); return new Response(null, { status: 401 }) }
    const range = request.headers.get('range')
    if (range && (!/^bytes=(?:\d+-\d*|-\d+)$/.test(range) || range.length > 80)) return new Response(null, { status: 416, headers: { 'cache-control': 'no-store', ...(resource.source.size ? { 'content-range': `bytes */${resource.source.size}` } : {}) } })
    if (this.active >= 40 || resource.streams.size >= 10 || ticket.streams.size >= 2) return new Response(null, { status: 429 })
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 30 * 60_000)
    timer.unref()
    const signal = AbortSignal.any([request.signal, resource.controller.signal, controller.signal])
    this.active++; resource.streams.add(controller); ticket.streams.add(controller)
    let released = false
    const release = () => {
      if (released) return
      released = true; clearTimeout(timer); this.active--; resource.streams.delete(controller); ticket.streams.delete(controller)
    }
    let response: Response | undefined
    try {
      response = await this.upstream(resource, request, signal)
      if ([403, 410].includes(response.status)) {
        await response.body?.cancel()
        // Refresh a signed URL only when the provider confirms identical file bytes.
        if (!resource.refreshing) resource.refreshing = (async () => {
          const credential = this.credentials.get(resource.roomId)?.[resource.platform]
          const updated = await resource.provider.resolve(credential?.cookie ?? '', resource.trackId, resource.controller.signal)
          if (!updated.hash || updated.hash !== resource.source.hash || !updated.size || updated.size !== resource.source.size) throw new HostedSourceError('房间音源已过期或内容已变化，请房主重试以重新准备音源')
          resource.source = updated
        })().finally(() => { resource.refreshing = undefined })
        await resource.refreshing
        response = await this.upstream(resource, request, signal)
      }
      if (![200, 206, 416].includes(response.status)) throw new HostedSourceError('房间音源服务拒绝请求，请房主重试或重新绑定')
      const headers = new Headers({ 'cache-control': 'no-store, private', 'referrer-policy': 'no-referrer', 'x-content-type-options': 'nosniff' })
      const length = response.headers.get('content-length')
      const contentRange = response.headers.get('content-range')
      let expectedLength = length ? Number(length) : undefined
      if (response.status === 416) {
        if (contentRange && /^bytes \*\/\d+$/.test(contentRange)) headers.set('content-range', contentRange)
        await response.body?.cancel(); release()
        return new Response(null, { status: 416, headers })
      }
      const type = response.headers.get('content-type')?.split(';')[0] ?? ''
      if ((!type.startsWith('audio/') && type !== 'application/octet-stream' && !resource.provider.acceptsMediaType?.(type)) || (length && (!/^\d+$/.test(length) || Number(length) > MAX_RESPONSE_BYTES)) || (response.headers.get('content-encoding') && response.headers.get('content-encoding') !== 'identity')) throw new HostedSourceError('房间音源不是受支持的音频响应')
      if (response.status === 206) {
        const match = /^bytes (\d+)-(\d+)\/(\d+)$/.exec(contentRange ?? '')
        if (!range || !match || Number(match[2]) < Number(match[1]) || Number(match[3]) <= Number(match[2]) || (length && Number(length) !== Number(match[2]) - Number(match[1]) + 1)) throw new HostedSourceError('房间音源的 Range 响应无效')
        const first = Number(match[1]); const last = Number(match[2]); const total = Number(match[3])
        const requested = /^bytes=(\d*)-(\d*)$/.exec(range)!
        if (![first, last, total].every(Number.isSafeInteger) || (resource.source.size && total !== resource.source.size)
          || (requested[1] ? first !== Number(requested[1]) || last > Math.min(requested[2] ? Number(requested[2]) : total - 1, total - 1)
            : last !== total - 1 || first !== Math.max(0, total - Number(requested[2])))) throw new HostedSourceError('房间音源的 Range 与请求不一致')
        headers.set('content-range', contentRange!)
        expectedLength = last - first + 1
      }
      headers.set('content-type', type)
      if (length) headers.set('content-length', length)
      headers.set('accept-ranges', response.headers.get('accept-ranges') === 'bytes' ? 'bytes' : 'none')
      if (request.method === 'HEAD') { await response.body?.cancel(); release(); return new Response(null, { status: response.status, headers }) }
      if (!response.body) throw new HostedSourceError('房间音源响应为空')
      const reader = response.body.getReader()
      let bytes = 0
      let abort: () => void
      const body = new ReadableStream<Uint8Array>({
        start(stream) {
          abort = () => { void reader.cancel().catch(() => {}); try { stream.error(new Error('媒体传输已取消')) } catch {} release() }
          signal.addEventListener('abort', abort, { once: true })
          if (signal.aborted) abort()
        },
        pull: async (stream) => {
          try {
            const value = await reader.read()
            if (signal.aborted) return
            if (value.done) {
              if (expectedLength !== undefined && bytes !== expectedLength) throw new HostedSourceError('房间音源响应长度不完整')
              signal.removeEventListener('abort', abort); release(); stream.close(); return
            }
            bytes += value.value.byteLength
            if (bytes > MAX_RESPONSE_BYTES || (expectedLength !== undefined && bytes > expectedLength)) throw new HostedSourceError('房间音源响应超出大小上限')
            this.charge(resource.roomId, value.value.byteLength)
            stream.enqueue(value.value)
          }
          catch (error) {
            const cancelled = signal.aborted
            signal.removeEventListener('abort', abort); release(); controller.abort(); void reader.cancel().catch(() => {})
            if (!cancelled) this.fail(resource.roomId, resource.version, resource.playbackId, resource.platform, error)
            stream.error(new Error('房间媒体传输失败'))
          }
        },
        cancel: async () => { signal.removeEventListener('abort', abort); release(); controller.abort(); await reader.cancel().catch(() => {}) },
      })
      return new Response(body, { status: response.status, headers })
    }
    catch (error) {
      const cancelled = signal.aborted
      await response?.body?.cancel().catch(() => {})
      release(); controller.abort()
      if (!cancelled) this.fail(resource.roomId, resource.version, resource.playbackId, resource.platform, error)
      return new Response(null, { status: 502, headers: { 'cache-control': 'no-store' } })
    }
  }
}
