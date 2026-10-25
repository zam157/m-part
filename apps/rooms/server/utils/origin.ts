/** Origin checks are opt-in. An explicitly empty allowlist rejects every origin. */
export function isRoomOriginAllowed(origin: string | null, allowedOrigins?: string) {
  if (allowedOrigins === undefined) return true
  return !!origin && allowedOrigins.split(',').some(value => value.trim() === origin)
}
