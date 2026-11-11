import type { RoomProfile, RoomProfileInput } from '@m-part/listen-core/room-profile'

type AccountUser = { id: string, name: string, isAdmin: boolean }
export type AccountSession = { enabled: boolean, user: null } | { enabled: true, user: AccountUser, csrfToken: string }

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
