import { randomBytes, randomUUID } from 'node:crypto'
import { fileURLToPath } from 'node:url'
import { sql } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/node-postgres'
import { migrate } from 'drizzle-orm/node-postgres/migrator'
import { Pool } from 'pg'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { roomProfiles } from '../server/account/profiles'
import { getAccountService, profileCsrfToken } from '../server/account/service'

const databaseUrl = process.env.ACCOUNT_TEST_DATABASE_URL
const origin = 'http://localhost:3411'
const secret = randomBytes(32).toString('hex')
const database = `test_account_${randomUUID().replaceAll('-', '')}`
let admin: Pool
let pool: Pool
let service: ReturnType<typeof getAccountService>

describe.skipIf(!databaseUrl)('account profiles with PostgreSQL', () => {
  beforeAll(async () => {
    admin = new Pool({ connectionString: databaseUrl })
    await admin.query(`create database "${database}"`)
    const url = new URL(databaseUrl!)
    url.pathname = '/' + database
    pool = new Pool({ connectionString: url.href })
    const db = drizzle(pool)
    await migrate(db, { migrationsFolder: fileURLToPath(new URL('../drizzle/', import.meta.url)) })
    vi.stubEnv('DATABASE_URL', url.href)
    vi.stubEnv('BETTER_AUTH_URL', origin)
    vi.stubEnv('BETTER_AUTH_SECRET', secret)
    vi.stubEnv('GITHUB_CLIENT_ID', 'test-github-client')
    vi.stubEnv('GITHUB_CLIENT_SECRET', 'test-github-secret')
    service = getAccountService()
  })
  afterAll(async () => {
    vi.unstubAllEnvs()
    await service?.db.$client.end()
    await pool?.end()
    if (admin) {
      await admin.query(`drop database if exists "${database}"`)
      await admin.end()
    }
  })

  async function loginAs(id: number) {
    const auth = getAccountService()!.auth
    const response = await auth.handler(new Request(origin + '/api/auth/sign-in/social', {
      method: 'POST',
      headers: { origin, 'content-type': 'application/json' },
      body: JSON.stringify({ provider: 'github', callbackURL: '/settings', disableRedirect: true }),
    }))
    expect(response.status).toBe(200)
    const authorize = new URL((await response.json()).url)
    expect(authorize.origin + authorize.pathname).toBe('https://github.com/login/oauth/authorize')
    expect(authorize.searchParams.get('redirect_uri')).toBe(origin + '/api/auth/callback/github')
    const state = authorize.searchParams.get('state')
    expect(state).toBeTruthy()
    const stateCookie = response.headers.getSetCookie().map(value => value.split(';')[0]).join('; ')
    const email = `test-${id}@example.test`
    vi.stubGlobal('fetch', vi.fn(async (input: string | URL | Request) => {
      const url = input instanceof Request ? input.url : String(input)
      if (url === 'https://github.com/login/oauth/access_token') return Response.json({ access_token: `fixture-token-${id}`, token_type: 'bearer' })
      if (url === 'https://api.github.com/user') return Response.json({ id, login: `fixture-${id}`, email })
      if (url === 'https://api.github.com/user/emails') return Response.json([{ email, verified: true, primary: true }])
      throw new Error('Unexpected OAuth fixture request')
    }))
    try {
      const callback = new URL('/api/auth/callback/github', origin)
      callback.searchParams.set('state', state!)
      callback.searchParams.set('code', 'fixture-code')
      const signedIn = await auth.handler(new Request(callback, { headers: { cookie: stateCookie } }))
      expect(new URL(signedIn.headers.get('location')!, origin).href).toBe(origin + '/settings')
      const cookie = signedIn.headers.getSetCookie().find(value => value.startsWith('m-part.session_token='))?.split(';')[0]
      expect(cookie).toBeTruthy()
      const active = await auth.api.getSession({ headers: new Headers({ cookie: cookie! }) })
      expect(active?.user.email).toBe(email)
      return { cookie: cookie!, csrf: profileCsrfToken(secret, active!.session.id) }
    }
    finally { vi.unstubAllGlobals() }
  }

  it('signs in through Better Auth and isolates revisioned presets by user', async () => {
    const alice = await loginAs(1)
    const bob = await loginAs(2)
    const preset = { label: '家里', serverUrl: 'http://192.168.1.10:3410/', nickname: 'Alice' }
    const request = (method: string, user?: typeof alice, body?: object, originOverride = origin) => new Request(origin + '/api/account/room-profiles', {
      method,
      headers: { origin: originOverride, 'content-type': 'application/json', ...(user && { cookie: user.cookie, 'x-mpart-csrf': user.csrf }) },
      body: body && JSON.stringify(body),
    })
    expect((await roomProfiles(request('GET'))).status).toBe(401)
    expect((await roomProfiles(request('POST', alice, preset, 'https://other.example'))).status).toBe(403)
    expect((await roomProfiles(request('POST', { ...alice, csrf: bob.csrf }, preset))).status).toBe(403)
    expect((await roomProfiles(request('POST', alice, { ...preset, serverUrl: 'https://rooms.example/private' }))).status).toBe(400)

    const created = await roomProfiles(request('POST', alice, preset))
    expect(created.status).toBe(201)
    const profile = await created.json()
    expect(profile).toMatchObject({ label: '家里', serverUrl: 'http://192.168.1.10:3410', nickname: 'Alice', revision: 1 })
    expect((await roomProfiles(request('POST', alice, preset))).status).toBe(409)
    expect(await (await roomProfiles(request('GET', bob))).json()).toEqual([])
    expect((await roomProfiles(request('PUT', bob, { ...preset, revision: 1 }), profile.id)).status).toBe(404)

    const edits = await Promise.all(['A', 'B'].map(nickname => roomProfiles(request('PUT', alice, { ...preset, nickname, revision: 1 }), profile.id)))
    expect(edits.map(response => response.status).sort()).toEqual([200, 409])
    expect((await roomProfiles(request('DELETE', alice, { revision: 1 }), profile.id)).status).toBe(409)
    expect((await roomProfiles(request('DELETE', bob, { revision: 2 }), profile.id)).status).toBe(404)
    expect((await roomProfiles(request('DELETE', alice, { revision: 2 }), profile.id)).status).toBe(200)
    expect(await (await roomProfiles(request('GET', alice))).json()).toEqual([])

    const rows = await getAccountService()!.db.execute(sql`select "accessToken" from account`)
    expect(rows.rows).toHaveLength(2)
    expect(rows.rows.every(row => typeof row.accessToken === 'string' && !row.accessToken.includes('fixture-token'))).toBe(true)

    await getAccountService()!.auth.handler(new Request(origin + '/api/auth/sign-out', {
      method: 'POST', headers: { origin, cookie: alice.cookie, 'content-type': 'application/json' }, body: '{}',
    }))
    expect((await roomProfiles(request('GET', alice))).status).toBe(401)
  })
})
