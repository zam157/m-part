import { createHmac, timingSafeEqual } from 'node:crypto'
import { betterAuth } from 'better-auth/minimal'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { drizzle } from 'drizzle-orm/node-postgres'
import { Pool } from 'pg'
import * as schema from './schema'

function createAccountService(databaseUrl: string, origin: string, secret: string, clientId: string, clientSecret: string) {
  const pool = new Pool({ connectionString: databaseUrl, connectionTimeoutMillis: 5000 })
  // Idle connection errors should not terminate the Web player or print database details.
  pool.on('error', () => console.error('[account] PostgreSQL connection failed'))
  const db = drizzle(pool, { schema })
  const auth = betterAuth({
    baseURL: origin,
    secret,
    database: drizzleAdapter(db, { provider: 'pg', schema }),
    telemetry: { enabled: false },
    socialProviders: { github: { clientId, clientSecret } },
    account: { encryptOAuthTokens: true, accountLinking: { enabled: false } },
    advanced: { cookiePrefix: 'm-part', useSecureCookies: origin.startsWith('https:') },
  })
  return { auth, db, origin, secret }
}

let service: ReturnType<typeof createAccountService> | undefined
export function getAccountService() {
  if (service) return service
  const { DATABASE_URL, BETTER_AUTH_URL, BETTER_AUTH_SECRET, GITHUB_CLIENT_ID, GITHUB_CLIENT_SECRET } = process.env
  if (!DATABASE_URL || !BETTER_AUTH_URL || !BETTER_AUTH_SECRET || !GITHUB_CLIENT_ID || !GITHUB_CLIENT_SECRET) return
  const url = new URL(BETTER_AUTH_URL)
  const loopback = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)
  if (url.href !== url.origin + '/' || (url.protocol !== 'https:' && !(url.protocol === 'http:' && loopback)) || BETTER_AUTH_SECRET.length < 32)
    throw new Error('账号服务配置无效')
  service = createAccountService(DATABASE_URL, url.origin, BETTER_AUTH_SECRET, GITHUB_CLIENT_ID, GITHUB_CLIENT_SECRET)
  return service
}

export function accountJson(data: unknown, status = 200) {
  return Response.json(data, { status, headers: { 'cache-control': 'no-store' } })
}

export function accountError(status: number, message: string) {
  return accountJson({ message }, status)
}

export function profileCsrfToken(secret: string, sessionId: string) {
  return createHmac('sha256', secret).update('m-part:room-profiles:' + sessionId).digest('base64url')
}

export function validProfileWrite(request: Request, origin: string, secret: string, sessionId: string) {
  if (request.headers.get('origin') !== origin) return false
  const supplied = Buffer.from(request.headers.get('x-mpart-csrf') ?? '')
  const expected = Buffer.from(profileCsrfToken(secret, sessionId))
  return supplied.length === expected.length && timingSafeEqual(supplied, expected)
}
