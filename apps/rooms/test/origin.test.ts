import { describe, expect, it } from 'vitest'
import { isRoomOriginAllowed } from '../server/utils/origin'

const extension = `chrome-extension://${'a'.repeat(32)}`
const otherExtension = `chrome-extension://${'p'.repeat(32)}`

describe('optional room origin validation', () => {
  it.each([null, '', 'null', extension, otherExtension, 'https://app.example', 'http://localhost:3333', 'chrome-extension://short'])('skips validation when the allowlist is not configured: %s', (origin) => {
    expect(isRoomOriginAllowed(origin)).toBe(true)
  })

  it('keeps an explicitly configured allowlist authoritative, including an empty list', () => {
    expect(isRoomOriginAllowed(extension, ` ${extension}, https://app.example `)).toBe(true)
    expect(isRoomOriginAllowed('https://app.example', ` ${extension}, https://app.example `)).toBe(true)
    expect(isRoomOriginAllowed(otherExtension, extension)).toBe(false)
    expect(isRoomOriginAllowed(extension, '')).toBe(false)
    expect(isRoomOriginAllowed(extension, ' , ')).toBe(false)
    expect(isRoomOriginAllowed(null, extension)).toBe(false)
    expect(isRoomOriginAllowed('', '')).toBe(false)
    expect(isRoomOriginAllowed('https://app.example.evil.test', 'https://app.example')).toBe(false)
    expect(isRoomOriginAllowed('https://app.example/', 'https://app.example')).toBe(false)
  })
})
