import { and, asc, count, eq, sql } from 'drizzle-orm'
import { assertBodySize, HTTPError, readBody } from 'nitro/h3'
import * as v from 'valibot'
import { roomProfileInput, roomProfileRevision, roomProfileUpdate } from '@m-part/listen-core/room-profile'
import { roomProfile, user } from './schema'
import { accountError, accountJson, getAccountService, validProfileWrite } from './service'

const MAX_PROFILES = 30
const projection = { id: roomProfile.id, label: roomProfile.label, serverUrl: roomProfile.serverUrl, nickname: roomProfile.nickname, revision: roomProfile.revision }
const idSchema = v.pipe(v.string(), v.uuid())
const deleteInput = v.strictObject({ revision: roomProfileRevision })

export async function roomProfiles(request: Request, id?: string) {
  const { method } = request
  if (!(id === undefined ? ['GET', 'POST'] : ['PUT', 'DELETE']).includes(method)) return accountError(405, '不支持的请求方法')
  try {
    const service = getAccountService()
    if (!service) return accountError(503, '账号服务未配置')
    const session = await service.auth.api.getSession({ headers: request.headers })
    if (!session) return accountError(401, '请先登录 m-part')
    const userId = session.user.id
    const ownProfiles = eq(roomProfile.userId, userId)
    const { db } = service

    if (method === 'GET') {
      const profiles = await db.select(projection).from(roomProfile).where(ownProfiles).orderBy(asc(roomProfile.label))
      return accountJson(profiles)
    }

    if (!validProfileWrite(request, service.origin, service.secret, session.session.id)) return accountError(403, '请求来源无效，请刷新后重试')
    if (!/^application\/json(?:;|$)/i.test(request.headers.get('content-type') ?? '')) return accountError(415, '请使用 JSON 请求')
    if (id !== undefined && !v.is(idSchema, id)) return accountError(404, '房间预设不存在')
    const event = { req: request }
    assertBodySize(event, 8192)
    const body = await readBody(event)
    if (method === 'POST') {
      const parsed = v.safeParse(roomProfileInput, body)
      if (!parsed.success) return accountError(400, '请填写有效的预设名称、服务器地址和昵称')
      const profile = await db.transaction(async (tx) => {
        // Serialize creation for this user so simultaneous requests cannot exceed the cap.
        await tx.select({ id: user.id }).from(user).where(eq(user.id, userId)).for('update')
        const [result] = await tx.select({ total: count() }).from(roomProfile).where(ownProfiles)
        if (result!.total >= MAX_PROFILES) return
        const [created] = await tx.insert(roomProfile).values({ ...parsed.output, userId }).returning(projection)
        return created
      })
      return profile ? accountJson(profile, 201) : accountError(409, `最多可保存 ${MAX_PROFILES} 个房间预设`)
    }

    const ownProfile = and(ownProfiles, eq(roomProfile.id, id!))
    if (method === 'PUT') {
      const parsed = v.safeParse(roomProfileUpdate, body)
      if (!parsed.success) return accountError(400, '请填写有效的房间预设')
      const { revision, ...input } = parsed.output
      const [updated] = await db.update(roomProfile).set({ ...input, revision: sql`${roomProfile.revision} + 1` })
        .where(and(ownProfile, eq(roomProfile.revision, revision))).returning(projection)
      if (updated) return accountJson(updated)
    }
    else {
      const parsed = v.safeParse(deleteInput, body)
      if (!parsed.success) return accountError(400, '请提供有效的预设版本')
      const [deleted] = await db.delete(roomProfile).where(and(ownProfile, eq(roomProfile.revision, parsed.output.revision))).returning({ id: roomProfile.id })
      if (deleted) return accountJson(deleted)
    }
    const [existing] = await db.select({ id: roomProfile.id }).from(roomProfile).where(ownProfile)
    return existing ? accountError(409, '预设已在其他设备修改，请刷新后重试') : accountError(404, '房间预设不存在')
  }
  catch (error) {
    if (error instanceof HTTPError && error.status === 413) return accountError(413, '房间预设内容过大')
    if (error instanceof HTTPError && error.status === 400) return accountError(400, '请求内容无效')
    if (hasDuplicateKey(error)) return accountError(409, '已有同名的房间预设')
    return accountError(503, '房间预设暂不可用，请稍后重试')
  }
}

function hasDuplicateKey(error: unknown): boolean {
  return error instanceof Error && (('code' in error && error.code === '23505') || (error.cause !== error && hasDuplicateKey(error.cause)))
}
