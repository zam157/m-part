import { defineHandler } from 'nitro'
import { assertBodySize, HTTPError, readBody } from 'nitro/h3'
import * as v from 'valibot'
import { credentialEmail, signInInput } from '../../account/credentials'
import { accountError, accountJson, getAccountService } from '../../account/service'

export async function handleAccountAuth(request: Request) {
  const path = new URL(request.url).pathname
  const signingIn = path === '/api/auth/sign-in'
  if (request.method !== 'POST' || (!signingIn && path !== '/api/auth/sign-out'))
    return accountError(404, '接口不存在')

  try {
    const service = await getAccountService()
    if (!service) return accountError(503, '账号服务未配置')
    if (request.headers.get('origin') !== service.origin) return accountError(403, '请求来源无效')
    if (!/^application\/json(?:;|$)/i.test(request.headers.get('content-type') ?? ''))
      return accountError(415, '请使用 JSON 请求')

    let authRequest = request
    if (signingIn) {
      const event = { req: request }
      await assertBodySize(event, 2048)
      const parsed = v.safeParse(signInInput, await readBody(event))
      if (!parsed.success) return accountError(400, '请填写有效的用户名和密码')
      const { username, password } = parsed.output
      const headers = new Headers(request.headers)
      headers.delete('content-length')
      authRequest = new Request(service.origin + '/api/auth/sign-in/email', {
        method: 'POST', headers, body: JSON.stringify({ email: credentialEmail(username), password }),
      })
    }

    const response = await service.auth.handler(authRequest)
    if (response.ok) {
      const result = accountJson({ success: true })
      for (const cookie of response.headers.getSetCookie()) result.headers.append('set-cookie', cookie)
      return result
    }
    if (response.status === 401) return accountError(401, '用户名或密码错误')
    if (response.status === 429) {
      const result = accountError(429, '尝试过于频繁，请稍后重试')
      const retryAfter = response.headers.get('retry-after')
      if (retryAfter) result.headers.set('retry-after', retryAfter)
      return result
    }
    return accountError(503, '账号服务暂不可用，请稍后重试')
  }
  catch (error) {
    if (error instanceof HTTPError && error.status === 413) return accountError(413, '请求内容过大')
    if (error instanceof HTTPError && error.status === 400) return accountError(400, '请求内容无效')
    return accountError(503, '账号服务暂不可用，请稍后重试')
  }
}

export default defineHandler(event => handleAccountAuth(event.req))
