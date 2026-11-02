import { TARGET_EXTENSION } from '../constants'
import { clientCookieValue, getClientCookie } from '../client-cookies'

interface ExtensionCookies {
  get: (details: { url: string, name: string }) => Promise<{ value: string } | null>
}

/** 从当前选定的整套会话读取 CSRF；手动 Cookie 缺字段时不补读网站账号。 */
export async function getNeteaseCsrfToken(manual = getClientCookie('netease')): Promise<string> {
  if (manual) return clientCookieValue(manual, '__csrf')
  const browser = globalThis as typeof globalThis & { chrome?: { cookies?: ExtensionCookies } }
  if (!TARGET_EXTENSION || !browser.chrome?.cookies)
    return ''
  const cookie = await browser.chrome.cookies.get({ url: 'https://music.163.com/', name: '__csrf' })
  return cookie?.value ?? ''
}
