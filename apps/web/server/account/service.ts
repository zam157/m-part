import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto'
import { betterAuth } from 'better-auth/minimal'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { and, eq } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/node-postgres'
import { Pool } from 'pg'
import * as v from 'valibot'
import { adminId, adminUsername, credentialEmail, credentialProvider, newPasswordSchema } from './credentials'
import * as schema from './schema'

async function createAccountService(databaseUrl: string, origin: string, secret: string, adminPassword: string) {
  const pool = new Pool({ connectionString: databaseUrl, connectionTimeoutMillis: 5000 })
  // Idle connection errors should not terminate the Web player or print database details.
  pool.on('error', () => console.error('[account] PostgreSQL connection failed'))
  const db = drizzle(pool, { schema })
  const auth = betterAuth({
    baseURL: origin,
    secret,
    database: drizzleAdapter(db, { provider: 'pg', schema }),
    telemetry: { enabled: false },
    emailAndPassword: { enabled: true, disableSignUp: true, minPasswordLength: 12, maxPasswordLength: 128 },
    account: { accountLinking: { enabled: false } },
    rateLimit: { enabled: true, customRules: { '/sign-in/email': { window: 60, max: 10 } } },
    advanced: {
      cookiePrefix: 'm-part',
      useSecureCookies: origin.startsWith('https:'),
      ipAddress: { ipAddressHeaders: process.env.ACCOUNT_CLIENT_IP_HEADER ? [process.env.ACCOUNT_CLIENT_IP_HEADER] : [] },
    },
    logger: { level: 'error' },
    onAPIError: { onError: () => console.error('[account] Authentication request failed') },
  })

  try {
    const { password } = await auth.$context
    const { user, account, session } = schema
    await db.transaction(async (tx) => {
      await tx.insert(user).values({ id: adminId, name: adminUsername, email: credentialEmail(adminUsername) })
        .onConflictDoNothing({ target: user.id })
      // Serialize administrator provisioning across Web instances.
      await tx.select({ id: user.id }).from(user).where(eq(user.id, adminId)).for('update')
      const credential = and(eq(account.userId, adminId), eq(account.providerId, credentialProvider))
      const [existing] = await tx.select({ password: account.password }).from(account).where(credential)
      if (existing?.password && await password.verify({ hash: existing.password, password: adminPassword })) return

      const hash = await password.hash(adminPassword)
      if (existing) {
        await tx.update(account).set({ password: hash, updatedAt: new Date() }).where(credential)
        await tx.delete(session).where(eq(session.userId, adminId))
      }
      else {
        await tx.insert(account).values({ id: randomUUID(), accountId: adminId, providerId: credentialProvider, userId: adminId, password: hash })
      }
    })
  }
  catch (error) {
    await pool.end()
    throw error
  }
  return { auth, db, origin, secret }
}

let service: ReturnType<typeof createAccountService> | undefined
export async function getAccountService() {
  if (service) return service
  const { DATABASE_URL, BETTER_AUTH_URL, BETTER_AUTH_SECRET, MPART_ADMIN_PASSWORD } = process.env
  if (!DATABASE_URL || !BETTER_AUTH_URL || !BETTER_AUTH_SECRET || !MPART_ADMIN_PASSWORD) return
  const url = new URL(BETTER_AUTH_URL)
  const loopback = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)
  if (url.href !== url.origin + '/' || (url.protocol !== 'https:' && !(url.protocol === 'http:' && loopback))
    || BETTER_AUTH_SECRET.length < 32 || !v.is(newPasswordSchema, MPART_ADMIN_PASSWORD))
    throw new Error('账号服务配置无效')
  service = createAccountService(DATABASE_URL, url.origin, BETTER_AUTH_SECRET, MPART_ADMIN_PASSWORD).catch((error) => {
    service = undefined
    throw error
  })
  return service
}

export function accountJson(data: unknown, status = 200) {
  return Response.json(data, { status, headers: { 'cache-control': 'no-store' } })
}

export function accountError(status: number, message: string) {
  return accountJson({ message }, status)
}

export function accountCsrfToken(secret: string, sessionId: string) {
  return createHmac('sha256', secret).update('m-part:account:' + sessionId).digest('base64url')
}

export function validAccountWrite(request: Request, origin: string, secret: string, sessionId: string) {
  if (request.headers.get('origin') !== origin) return false
  const supplied = Buffer.from(request.headers.get('x-mpart-csrf') ?? '')
  const expected = Buffer.from(accountCsrfToken(secret, sessionId))
  return supplied.length === expected.length && timingSafeEqual(supplied, expected)
}
