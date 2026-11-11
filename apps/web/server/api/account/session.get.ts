import { defineHandler } from 'nitro'
import { readListenAccountConfig } from '@m-part/listen-core/account-proof'
import { adminId } from '../../account/credentials'
import { accountError, accountJson, getAccountService, accountCsrfToken } from '../../account/service'

export default defineHandler(async (event) => {
  try {
    const service = await getAccountService()
    if (!service) return accountJson({ enabled: false, user: null })
    const session = await service.auth.api.getSession({ headers: event.req.headers })
    return accountJson(session
      ? {
          enabled: true, user: { id: session.user.id, name: session.user.name, isAdmin: session.user.id === adminId },
          csrfToken: accountCsrfToken(service.secret, session.session.id), listenServer: readListenAccountConfig(process.env)?.audience,
        }
      : { enabled: true, user: null })
  }
  catch { return accountError(503, '账号服务暂不可用，请稍后重试') }
})
