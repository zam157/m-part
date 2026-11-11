import * as v from 'valibot'

export const adminUsername = 'admin'
export const adminId = 'm-part-administrator'
export const credentialProvider = 'credential'
export const usernameSchema = v.pipe(v.string(), v.trim(), v.toLowerCase(), v.regex(/^[a-z0-9][a-z0-9_-]{2,31}$/))
export const newPasswordSchema = v.pipe(v.string(), v.minLength(12), v.maxLength(128))
export const signInInput = v.strictObject({
  username: usernameSchema,
  password: v.pipe(v.string(), v.minLength(1), v.maxLength(128)),
})
export const createUserInput = v.strictObject({ username: usernameSchema, password: newPasswordSchema })

// Better Auth's credential provider needs an internal email identifier.
export function credentialEmail(username: string) {
  return `${username}@accounts.m-part.invalid`
}
