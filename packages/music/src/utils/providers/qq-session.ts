import { TARGET_EXTENSION } from '../constants'
import { qqToken } from './qq-crypto'

export { qqToken } from './qq-crypto'

interface ExtensionCookies {
  get: (details: { url: string, name: string }) => Promise<{ value: string } | null>
}

/** 仅在请求时读取 QQ 音乐自身的 Cookie，不保存、不回写，也不手动设置 Cookie 头。 */
export async function getQQSession() {
  const browser = globalThis as typeof globalThis & { chrome?: { cookies?: ExtensionCookies } }
  if (!TARGET_EXTENSION || !browser.chrome?.cookies) return { uin: '0', key: '', token: 5381 }
  const names = ['qqmusic_uin', 'uin', 'wxuin', 'qqmusic_key', 'qm_keyst', 'p_skey', 'skey'] as const
  const values = await Promise.all(names.map(async (name) => [name, (await browser.chrome!.cookies!.get({ url: 'https://y.qq.com/', name }))?.value ?? ''] as const))
  const cookies = Object.fromEntries(values)
  const uin = [cookies.qqmusic_uin, cookies.uin, cookies.wxuin].map(value => (value ?? '').replace(/^o0*/, '')).find(value => /^\d+$/.test(value) && Number(value) > 0) ?? '0'
  const key = cookies.qqmusic_key || cookies.qm_keyst || cookies.p_skey || cookies.skey || ''
  return { uin, key, token: qqToken(key) }
}

export type QQSession = Awaited<ReturnType<typeof getQQSession>>
