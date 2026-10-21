import { TARGET_EXTENSION } from '../constants'

interface ExtensionCookies {
  get: (details: { url: string, name: string }) => Promise<{ value: string } | null>
}

/** 登录 Cookie 仍由 credentials 携带；只读取加密请求所需的 CSRF 参数。 */
export async function getNeteaseCsrfToken(): Promise<string> {
  const browser = globalThis as typeof globalThis & { chrome?: { cookies?: ExtensionCookies } }
  if (!TARGET_EXTENSION || !browser.chrome?.cookies)
    return ''
  const cookie = await browser.chrome.cookies.get({ url: 'https://music.163.com/', name: '__csrf' })
  return cookie?.value ?? ''
}
