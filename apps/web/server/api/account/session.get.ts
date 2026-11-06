import { defineHandler } from 'nitro'
import { accountError, accountJson, getAccountService, profileCsrfToken } from '../../account/service'

export default defineHandler(async (event) => {
  try {
    const service = getAccountService()
    if (!service) return accountJson({ enabled: false, user: null })
    const session = await service.auth.api.getSession({ headers: event.req.headers })
    return accountJson(session
      ? { enabled: true, user: { id: session.user.id, name: session.user.name }, csrfToken: profileCsrfToken(service.secret, session.session.id) }
      : { enabled: true, user: null })
  }
  catch { return accountError(503, '账号服务暂不可用，请稍后重试') }
})
