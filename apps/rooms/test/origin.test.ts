import { describe, expect, it } from 'vitest'
import { isRoomOriginAllowed } from '../server/utils/origin'

const extension = `chrome-extension://${'a'.repeat(32)}`
const otherExtension = `chrome-extension://${'p'.repeat(32)}`

describe('room WebSocket origins', () => {
  it.each([
    'localhost', '127.0.0.1', '10.0.0.1', '172.16.0.1', '172.31.255.255',
    '192.168.1.10', '169.254.1.10', '[::1]', '[fd00::1]', '[fe80::1]',
  ])('allows different extension IDs on local server %s', (host) => {
    const url = `http://${host}:3410/ws`
    expect(isRoomOriginAllowed(url, extension)).toBe(true)
    expect(isRoomOriginAllowed(url, otherExtension)).toBe(true)
    expect(isRoomOriginAllowed(url, new URL(url).origin)).toBe(true)
    expect(isRoomOriginAllowed(url, 'https://unrelated.example')).toBe(false)
  })

  it.each(['172.15.255.255', '172.32.0.1', '192.169.0.1', '8.8.8.8', 'rooms.example.com', '192.168.1.10.example.com', '[2001:4860:4860::8888]'])('requires an allowlist for public server %s', (host) => {
    const url = `https://${host}/ws`
    expect(isRoomOriginAllowed(url, extension)).toBe(false)
    expect(isRoomOriginAllowed(url, extension, extension)).toBe(true)
  })

  it.each([null, 'null', 'chrome-extension://short', `chrome-extension://${'z'.repeat(32)}`, `${extension}/`, 'https://evil.example'])('rejects missing or unrelated origin %s on LAN', (origin) => {
    expect(isRoomOriginAllowed('http://192.168.1.10:3410/ws', origin)).toBe(false)
  })

  it('keeps an explicitly configured allowlist authoritative, including an empty list', () => {
    const url = 'http://192.168.1.10:3410/ws'
    expect(isRoomOriginAllowed(url, extension, ` ${extension}, https://app.example `)).toBe(true)
    expect(isRoomOriginAllowed(url, 'https://app.example', ` ${extension}, https://app.example `)).toBe(true)
    expect(isRoomOriginAllowed(url, otherExtension, extension)).toBe(false)
    expect(isRoomOriginAllowed(url, extension, '')).toBe(false)
  })
})
