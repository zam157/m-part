import { TARGET_EXTENSION } from '../constants'
import { qqToken } from './qq-crypto'
import { clientCookieValue, getClientCookie } from '../client-cookies'

export { qqToken } from './qq-crypto'

interface ExtensionCookies {
  get: (details: { url: string, name: string }) => Promise<{ value: string } | null>
}

/** 优先读取本机显式设置，否则读取网站 Cookie；两套会话字段不能混用。 */
export async function getQQSession() {
  const browser = globalThis as typeof globalThis & { chrome?: { cookies?: ExtensionCookies } }
  const manual = getClientCookie('qq')
  if (!manual && (!TARGET_EXTENSION || !browser.chrome?.cookies)) return { uin: '0', key: '', token: 5381, cookieContext: '' }
  const names = ['qqmusic_uin', 'uin', 'wxuin', 'qqmusic_key', 'qm_keyst', 'p_skey', 'skey'] as const
  const values = await Promise.all(names.map(async (name) => [name, manual ? clientCookieValue(manual, name) : (await browser.chrome!.cookies!.get({ url: 'https://y.qq.com/', name }))?.value ?? ''] as const))
  const cookies = Object.fromEntries(values)
  const uin = [cookies.qqmusic_uin, cookies.uin, cookies.wxuin].map(value => (value ?? '').replace(/^o0*/, '')).find(value => /^\d+$/.test(value) && Number(value) > 0) ?? '0'
  const key = cookies.qqmusic_key || cookies.qm_keyst || cookies.p_skey || cookies.skey || ''
  return { uin, key, token: qqToken(key), cookieContext: manual }
}

export type QQSession = Awaited<ReturnType<typeof getQQSession>>
