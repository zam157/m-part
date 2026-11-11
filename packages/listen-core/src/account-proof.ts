import { createHmac, timingSafeEqual } from 'node:crypto'
import { normalizeRoomServer } from './room-server'

const lifetime = 30_000

export function readListenAccountConfig(env: Record<string, string | undefined>) {
  const { LISTEN_ACCOUNT_SERVER_URL: url, LISTEN_ACCOUNT_SECRET: secret } = env
  if (!url && !secret) return
  if (!url || !secret || secret.length < 32) throw new Error('一起听账号服务配对配置无效')
  return { audience: normalizeRoomServer(url), secret }
}

type Config = NonNullable<ReturnType<typeof readListenAccountConfig>>
export interface ListenAccount { id: string, username: string }

function signature(secret: string, payload: string) {
  return createHmac('sha256', secret).update('m-part:listen-account:' + payload).digest()
}

export function signListenAccount(config: Config, account: ListenAccount, now = Date.now()) {
  const payload = Buffer.from(JSON.stringify({ sub: account.id, username: account.username, aud: config.audience, exp: now + lifetime })).toString('base64url')
  return payload + '.' + signature(config.secret, payload).toString('base64url')
}

export function verifyListenAccount(config: Config, token: string, now = Date.now()) {
  if (token.length > 1024) return
  const match = /^([A-Za-z0-9_-]+)\.([A-Za-z0-9_-]{43})$/.exec(token)
  if (!match) return
  const payload = match[1]!
  const proof = Buffer.from(match[2]!, 'base64url')
  if (!timingSafeEqual(proof, signature(config.secret, payload))) return
  try {
    const { sub, username, aud, exp } = JSON.parse(Buffer.from(payload, 'base64url').toString())
    if (typeof sub === 'string' && /^[A-Za-z0-9_-]{1,80}$/.test(sub) && aud === config.audience
      && typeof username === 'string' && /^[a-z0-9][a-z0-9_-]{2,31}$/.test(username)
      && Number.isSafeInteger(exp) && exp > now && exp <= now + lifetime + 5_000) return { id: sub, username } satisfies ListenAccount
  }
  catch {}
}
