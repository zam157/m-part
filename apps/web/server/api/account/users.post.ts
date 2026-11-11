import { randomUUID } from 'node:crypto'
import { defineHandler } from 'nitro'
import { assertBodySize, HTTPError, readBody } from 'nitro/h3'
import * as v from 'valibot'
import { adminId, adminUsername, createUserInput, credentialEmail, credentialProvider } from '../../account/credentials'
import { account, user } from '../../account/schema'
import { accountError, accountJson, getAccountService, validAccountWrite } from '../../account/service'

export async function createAccountUser(request: Request) {
  try {
    const service = await getAccountService()
    if (!service) return accountError(503, '账号服务未配置')
    const session = await service.auth.api.getSession({ headers: request.headers })
    if (!session) return accountError(401, '请先登录 m-part')
    if (session.user.id !== adminId) return accountError(403, '只有管理员可以创建用户')
    if (!validAccountWrite(request, service.origin, service.secret, session.session.id))
      return accountError(403, '请求来源无效，请刷新后重试')
    if (!/^application\/json(?:;|$)/i.test(request.headers.get('content-type') ?? ''))
      return accountError(415, '请使用 JSON 请求')

    const event = { req: request }
    await assertBodySize(event, 2048)
    const parsed = v.safeParse(createUserInput, await readBody(event))
    if (!parsed.success) return accountError(400, '请填写有效的用户名和至少 12 个字符的密码')
    const { username, password } = parsed.output
    if (username === adminUsername) return accountError(409, '该用户名已被使用')

    const hash = await (await service.auth.$context).password.hash(password)
    const id = randomUUID()
    const created = await service.db.transaction(async (tx) => {
      const [createdUser] = await tx.insert(user).values({ id, name: username, email: credentialEmail(username) })
        .onConflictDoNothing({ target: user.email }).returning({ id: user.id })
      if (!createdUser) return false
      await tx.insert(account).values({ id: randomUUID(), accountId: id, providerId: credentialProvider, userId: id, password: hash })
      return true
    })
    return created ? accountJson({ username }, 201) : accountError(409, '该用户名已被使用')
  }
  catch (error) {
    if (error instanceof HTTPError && error.status === 413) return accountError(413, '请求内容过大')
    if (error instanceof HTTPError && error.status === 400) return accountError(400, '请求内容无效')
    return accountError(503, '暂时无法创建用户，请稍后重试')
  }
}

export default defineHandler(event => createAccountUser(event.req))
