import { defineHandler } from 'nitro'
import { accountError, getAccountService } from '../../account/service'

export default defineHandler(async (event) => {
  try {
    const service = getAccountService()
    return service ? await service.auth.handler(event.req) : accountError(503, '账号服务未配置')
  }
  catch { return accountError(503, '账号服务暂不可用，请稍后重试') }
})
