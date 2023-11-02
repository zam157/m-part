import NeteaseCloudMusicApi from 'NeteaseCloudMusicApi'

interface BaseResponse<T extends Record<string, any>> {
  code: number
  message: string
  status: boolean
  data: T
}

type LoginResponse = BaseResponse<{
  cookie: string[]
}>

interface LoginCellphoneResponseBody {
  code: number
  message: string
  msg: string
}

interface LoginCellphoneRequest {
  body: {
    phone: string
    password: string
  }
}

export default defineEventHandler<LoginCellphoneRequest, Promise<LoginResponse>>(async (event) => {
  const body = await readBody(event)
  const res = await NeteaseCloudMusicApi.login_cellphone(body)
  const { code, message } = res.body as unknown as LoginCellphoneResponseBody
  return {
    code,
    message,
    status: code === 200,
    data: {
      cookie: res.cookie,
    },
  }
})
