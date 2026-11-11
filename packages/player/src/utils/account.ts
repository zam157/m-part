import type { RoomProfile, RoomProfileInput } from '@m-part/listen-core/room-profile'
import { accountRoomList } from '@m-part/listen-core/protocol'
import * as v from 'valibot'

type AccountUser = { id: string, name: string, isAdmin: boolean }
export type AccountSession = { enabled: boolean, user: null } | { enabled: true, user: AccountUser, csrfToken: string, listenServer?: string }

export class AccountError extends Error {
  constructor(readonly status: number, message: string) { super(message) }
}

async function accountRequest<T>(url: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(url, { ...init, credentials: 'same-origin', cache: 'no-store' })
  const body = await response.json().catch(() => null)
  if (!response.ok || body === null)
    throw new AccountError(response.status, typeof body?.message === 'string' ? body.message : '账号服务暂不可用，请稍后重试')
  return body as T
}

export const readAccountSession = (signal?: AbortSignal) => accountRequest<AccountSession>('/api/account/session', { signal })

export async function requestRoomAccount(server: string, signal?: AbortSignal) {
  const { proof } = await accountRequest<{ proof: string | null }>('/api/account/room-proof', {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ server }), signal,
  })
  return proof ?? undefined
}

export async function readAccountRooms(server: string, signal?: AbortSignal) {
  const proof = await requestRoomAccount(server, signal)
  if (!proof) return []
  const response = await fetch(`${server}/account-rooms`, {
    headers: { authorization: `Bearer ${proof}` }, credentials: 'omit', cache: 'no-store', redirect: 'error', signal,
  })
  if (!response.ok) throw new Error('无法读取长期房间，请检查房间服务器后重试')
  const parsed = v.safeParse(accountRoomList, await response.json())
  if (!parsed.success) throw new Error('房间列表格式无效，请更新房间服务')
  return parsed.output
}

export async function signInAccount(username: string, password: string) {
  await accountRequest('/api/auth/sign-in', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ username, password }),
  })
}

export function createAccountUser(username: string, password: string, csrfToken: string) {
  return accountRequest<{ username: string }>('/api/account/users', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-mpart-csrf': csrfToken },
    body: JSON.stringify({ username, password }),
  })
}

export async function signOutAccount() {
  await accountRequest('/api/auth/sign-out', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' })
}

const profilesPath = '/api/account/room-profiles'
export const readRoomProfiles = (signal?: AbortSignal) => accountRequest<RoomProfile[]>(profilesPath, { signal })
function writeProfile<T>(method: 'POST' | 'PUT' | 'DELETE', csrfToken: string, body: object, id?: string) {
  return accountRequest<T>(id ? `${profilesPath}/${encodeURIComponent(id)}` : profilesPath, {
    method,
    headers: { 'content-type': 'application/json', 'x-mpart-csrf': csrfToken },
    body: JSON.stringify(body),
  })
}
export const createRoomProfile = (input: RoomProfileInput, csrf: string) => writeProfile<RoomProfile>('POST', csrf, input)
export const updateRoomProfile = (id: string, input: RoomProfileInput & { revision: number }, csrf: string) => writeProfile<RoomProfile>('PUT', csrf, input, id)
export const deleteRoomProfile = (id: string, revision: number, csrf: string) => writeProfile<{ id: string }>('DELETE', csrf, { revision }, id)
