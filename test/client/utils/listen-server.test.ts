import { describe, expect, it } from 'vitest'
import { normalizeRoomServer } from '~/utils/listen-server'

describe('room server addresses', () => {
  it.each([
    [' http://192.168.1.10:3410/ ', 'http://192.168.1.10:3410'],
    ['http://rooms.example.com:3410', 'http://rooms.example.com:3410'],
    ['https://rooms.example.com/', 'https://rooms.example.com'],
    ['http://[fd00::1]:3410/', 'http://[fd00::1]:3410'],
    ['http://127.0.0.1:3410', 'http://127.0.0.1:3410'],
  ])('accepts %s', (input, expected) => {
    expect(normalizeRoomServer(input)).toBe(expected)
  })

  it.each([
    'ftp://rooms.example.com', 'ws://rooms.example.com', 'javascript:alert(1)',
    'http://user:secret@rooms.example.com', 'http://rooms.example.com/ws',
    'https://rooms.example.com?token=secret', 'https://rooms.example.com#room',
  ])('rejects non-HTTP endpoints, credentials and paths: %s', (input) => {
    expect(() => normalizeRoomServer(input)).toThrow()
  })
})
