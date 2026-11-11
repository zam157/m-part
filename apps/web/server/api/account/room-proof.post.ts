import { defineHandler } from 'nitro'
import { assertBodySize, HTTPError, readBody } from 'nitro/h3'
import { readListenAccountConfig, signListenAccount } from '@m-part/listen-core/account-proof'
import { normalizeRoomServer } from '@m-part/listen-core/room-server'
import { accountError, accountJson, getAccountService } from '../../account/service'

export async function issueRoomProof(request: Request) {
  try {
    const config = readListenAccountConfig(process.env)
    if (!config) return accountJson({ proof: null })
    if (!/^application\/json(?:;|$)/i.test(request.headers.get('content-type') ?? ''))
      return accountError(415, '请使用 JSON 请求')
    const event = { req: request }
    await assertBodySize(event, 4096)
    const body = await readBody(event)
    if (!body || typeof body !== 'object' || !('server' in body) || typeof body.server !== 'string')
      return accountError(400, '房间服务器地址无效')
    let server: string
    try { server = normalizeRoomServer(body.server) }
    catch { return accountError(400, '房间服务器地址无效') }
    if (server !== config.audience) return accountJson({ proof: null })
    const service = await getAccountService()
    if (!service) return accountJson({ proof: null })
    if (request.headers.get('origin') !== service.origin) return accountError(403, '请求来源无效')
    const session = await service.auth.api.getSession({ headers: request.headers })
    return accountJson({ proof: session ? signListenAccount(config, { id: session.user.id, username: session.user.name }) : null })
  }
  catch (error) {
    if (error instanceof HTTPError && (error.status === 413 || error.status === 400)) return accountError(error.status, '房间账号请求内容无效')
    return accountError(503, '房间账号服务暂不可用')
  }
}

export default defineHandler(event => issueRoomProof(event.req))
