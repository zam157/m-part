/** 将凭据过期与接口 / 网络故障区分，供页面展示重新登录入口。 */
export class LoginRequiredError extends Error {
  constructor(message = '登录凭据已失效，请在音源平台重新登录后刷新') {
    super(message)
    this.name = 'LoginRequiredError'
  }
}
