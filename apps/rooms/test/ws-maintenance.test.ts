import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { rooms } = vi.hoisted(() => ({ rooms: { hasRooms: false, sweep: vi.fn(), disconnect: vi.fn() } }))
vi.mock('../server/utils/runtime', () => ({ rooms }))
vi.mock('nitro', () => ({ defineWebSocketHandler: (handlers: unknown) => handlers }))

interface Peer { id: string, close: () => void }
const handlers = (await import('../server/routes/ws')).default as unknown as { open: (peer: Peer) => void, close: (peer: Peer) => void }
const peer = { id: 'maintenance-test', close: vi.fn() }
beforeEach(() => { vi.useFakeTimers(); rooms.hasRooms = false; rooms.sweep.mockReset(); rooms.disconnect.mockReset() })
afterEach(() => { rooms.hasRooms = false; handlers.close(peer); vi.useRealTimers() })

describe('disconnected room maintenance', () => {
  it('keeps sweeping after the last socket closes until the room and its private credentials expire', () => {
    rooms.hasRooms = true
    let sweeps = 0
    rooms.sweep.mockImplementation(() => { if (++sweeps === 20) rooms.hasRooms = false })
    handlers.open(peer)
    handlers.close(peer)
    vi.advanceTimersByTime(21_000)
    expect(rooms.sweep).toHaveBeenCalledTimes(20)
    expect(vi.getTimerCount()).toBe(0)
  })

  it('stops immediately when the last socket leaves no room to maintain', () => {
    handlers.open(peer)
    handlers.close(peer)
    expect(vi.getTimerCount()).toBe(0)
  })
})
