import { randomBytes, randomUUID } from 'node:crypto'
import { fileURLToPath } from 'node:url'
import { sql } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/node-postgres'
import { migrate } from 'drizzle-orm/node-postgres/migrator'
import { Pool } from 'pg'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { adminId } from '../server/account/credentials'
import { roomProfiles } from '../server/account/profiles'
import { accountCsrfToken, getAccountService } from '../server/account/service'
import { createAccountUser } from '../server/api/account/users.post'
import { handleAccountAuth } from '../server/api/auth/[...].ts'

const databaseUrl = process.env.ACCOUNT_TEST_DATABASE_URL
const origin = 'http://localhost:3411'
const secret = randomBytes(32).toString('hex')
const administratorPassword = randomBytes(24).toString('base64url')
const userPassword = randomBytes(24).toString('base64url')
const database = `test_account_${randomUUID().replaceAll('-', '')}`
let admin: Pool
let pool: Pool
let service: Awaited<ReturnType<typeof getAccountService>>

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
    vi.stubEnv('MPART_ADMIN_PASSWORD', administratorPassword)
    vi.stubEnv('ACCOUNT_CLIENT_IP_HEADER', '')
    service = await getAccountService()
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

  function authRequest(path: string, body: object, cookie?: string) {
    return new Request(origin + '/api/auth/' + path, {
      method: 'POST',
      headers: { origin, 'content-type': 'application/json', ...(cookie && { cookie }) },
      body: JSON.stringify(body),
    })
  }

  async function loginAs(username: string, password: string) {
    const response = await handleAccountAuth(authRequest('sign-in', { username, password }))
    expect(response.status, await response.clone().text()).toBe(200)
    expect(await response.json()).toEqual({ success: true })
    const sessionCookie = response.headers.getSetCookie().find(value => value.startsWith('m-part.session_token='))
    expect(sessionCookie).toMatch(/HttpOnly/i)
    const cookie = sessionCookie!.split(';')[0]!
    const active = await service!.auth.api.getSession({ headers: new Headers({ cookie }) })
    expect(active?.user.name).toBe(username.trim().toLowerCase())
    return { cookie, csrf: accountCsrfToken(secret, active!.session.id), userId: active!.user.id }
  }

  function createUser(username: string, active?: Awaited<ReturnType<typeof loginAs>>, originOverride = origin) {
    return createAccountUser(new Request(origin + '/api/account/users', {
      method: 'POST',
      headers: {
        origin: originOverride,
        'content-type': 'application/json',
        ...(active && { cookie: active.cookie, 'x-mpart-csrf': active.csrf }),
      },
      body: JSON.stringify({ username, password: userPassword }),
    }))
  }

  it('restricts account creation to the fixed administrator and isolates revisioned presets', async () => {
    expect((await handleAccountAuth(authRequest('sign-up/email', {}))).status).toBe(404)
    expect((await handleAccountAuth(authRequest('sign-in', { username: 'admin', password: userPassword }))).status).toBe(401)
    const administrator = await loginAs('admin', administratorPassword)
    expect(administrator.userId).toBe(adminId)
    expect((await createUser('alice')).status).toBe(401)
    expect((await createUser('alice', administrator, 'https://other.example')).status).toBe(403)
    expect((await createUser('alice', { ...administrator, csrf: 'wrong' })).status).toBe(403)
    expect((await createUser('ADMIN', administrator)).status).toBe(409)

    const creations = await Promise.all(['Alice', 'alice'].map(username => createUser(username, administrator)))
    expect(creations.map(response => response.status).sort()).toEqual([201, 409])
    expect(await creations.find(response => response.ok)!.json()).toEqual({ username: 'alice' })
    expect((await createUser('bob', administrator)).status).toBe(201)
    const alice = await loginAs('ALICE', userPassword)
    const bob = await loginAs('bob', userPassword)
    expect(alice.userId).not.toBe(adminId)
    expect((await createUser('another-user', alice)).status).toBe(403)

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

    const rows = await service!.db.execute(sql`select password from account`)
    expect(rows.rows).toHaveLength(3)
    expect(rows.rows.every(row => typeof row.password === 'string' && ![administratorPassword, userPassword].includes(row.password))).toBe(true)

    expect((await handleAccountAuth(authRequest('sign-out', {}, alice.cookie))).status).toBe(200)
    expect((await roomProfiles(request('GET', alice))).status).toBe(401)
  })
})
