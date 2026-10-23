import { flush } from 'solid-js'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { PlayerCache, PlayerStorage } from '~/utils/player-storage'
import { savePersonalPlayerSession, startPlayerPersistence } from '~/composables/player-persistence'
import { setRoomPlayerHandler } from '~/composables/player-context'

vi.mock('@m-part/music/providers', () => ({ providers: {} }))
const player = await import('~/composables/player')
const song = { provider: 'netease' as const, id: 'old', title: '歌曲', duration: 120, coverUrl: '' }
const cache: PlayerCache = {
  queue: { items: [song], playMode: 'order', randomOrder: null },
  position: { song, time: 40 }, volume: 0.3,
}
let persistence: ReturnType<typeof startPlayerPersistence> | undefined
let storage: PlayerStorage
beforeEach(async () => {
  vi.useFakeTimers()
  vi.spyOn(player.audio, 'pause').mockImplementation(() => {})
  vi.spyOn(player.audio, 'load').mockImplementation(() => {})
  vi.spyOn(player.audio, 'play').mockResolvedValue()
  await player.setPlayQueue([])
  player.setVolume(1)
  player.setPlayMode('order')
  flush()
  storage = { read: vi.fn().mockResolvedValue(cache), write: vi.fn().mockResolvedValue(undefined), close: vi.fn() }
})
afterEach(() => {
  setRoomPlayerHandler(undefined)
  flush()
  persistence?.dispose()
  persistence = undefined
  vi.restoreAllMocks()
  vi.useRealTimers()
})

describe('播放器缓存启动及观察', () => {
  it('房间队列及进度不写入个人缓存，音量仍作为个人偏好保存', async () => {
    persistence = startPlayerPersistence(storage)
    await persistence.ready
    const backup = await savePersonalPlayerSession()
    expect(backup.position?.time).toBe(40)
    vi.mocked(storage.write).mockClear()
    setRoomPlayerHandler(() => {})
    player.applyRoomQueue([{ ...song, id: 'room-track' }], 0, 'loop')
    flush()
    player.audio.currentTime = 80
    player.audio.dispatchEvent(new Event('timeupdate'))
    player.setVolume(0.7)
    flush()
    player.audio.dispatchEvent(new Event('pause'))
    await vi.advanceTimersByTimeAsync(6_000)
    await persistence.flush()
    expect(storage.write).toHaveBeenCalledWith({ volume: 0.7 })
    expect(vi.mocked(storage.write).mock.calls.every(([patch]) => !patch.queue && !patch.position)).toBe(true)
    setRoomPlayerHandler(undefined)
    player.restorePlayerSession(backup)
    flush()
    expect(player.currentSong()?.id).toBe('old')
    expect(player.currentTime()).toBe(40)
    expect(player.volume()).toBe(0.7)
    expect(player.playing()).toBe(false)
  })

  it('保护性保存等待缓存恢复，数据库写入失败会阻止入房', async () => {
    persistence = startPlayerPersistence(storage)
    await persistence.ready
    vi.mocked(storage.write).mockRejectedValueOnce(new Error('disk unavailable'))
    await expect(savePersonalPlayerSession()).rejects.toThrow('disk unavailable')
    expect(player.currentSong()?.id).toBe('old')
  })
  it('启动只读取一次，恢复不回写，连续进度变化只写小记录', async () => {
    persistence = startPlayerPersistence(storage)
    await persistence.ready
    flush()
    expect(player.currentTime()).toBe(40)
    expect(player.volume()).toBe(0.3)
    await persistence.flush()
    expect(storage.write).not.toHaveBeenCalled()
    for (let i = 1; i <= 80; i++) {
      player.setCurrentTime(40 + i / 10)
      flush()
      await vi.advanceTimersByTimeAsync(50)
    }
    expect(storage.write).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(1000)
    expect(storage.write).toHaveBeenCalledTimes(1)
    expect(storage.write).toHaveBeenLastCalledWith({ position: { song: { provider: 'netease', id: 'old' }, time: 48 } })
    expect(storage.read).toHaveBeenCalledTimes(1)
  })

  it('读取期间用户调整音量或开始播放新队列，旧缓存不会覆盖操作', async () => {
    let finish!: (value: PlayerCache) => void
    vi.mocked(storage.read).mockReturnValueOnce(new Promise(resolve => { finish = resolve }))
    persistence = startPlayerPersistence(storage)
    player.setVolume(0.8)
    await player.setPlayQueue([{ ...song, id: 'new', src: 'https://cdn.example/new.mp3' }])
    flush()
    finish(cache)
    await persistence.ready
    flush()
    expect(player.currentSong()?.id).toBe('new')
    expect(player.volume()).toBe(0.8)
    await persistence.flush()
    expect(storage.write).toHaveBeenLastCalledWith(expect.objectContaining({
      volume: 0.8,
      queue: expect.objectContaining({ items: [expect.objectContaining({ id: 'new' })] }),
      position: { song: { provider: 'netease', id: 'new' }, time: 0 },
    }))
  })

  it('拖动完成及时补存最新进度，重复无变化事件不写，卸载后解绑', async () => {
    persistence = startPlayerPersistence(storage)
    await persistence.ready
    player.setCurrentTime(65)
    flush()
    player.audio.dispatchEvent(new Event('seeked'))
    await persistence.flush()
    expect(storage.write).toHaveBeenLastCalledWith({ position: { song: { provider: 'netease', id: 'old' }, time: 65 } })
    player.audio.dispatchEvent(new Event('pause'))
    await persistence.flush()
    expect(storage.write).toHaveBeenCalledTimes(1)
    persistence.dispose()
    player.setVolume(0.5)
    player.audio.dispatchEvent(new Event('pause'))
    flush()
    await vi.advanceTimersByTimeAsync(6000)
    expect(storage.write).toHaveBeenCalledTimes(1)
  })

  it('数据库读取失败不影响后续播放器操作及保存', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    vi.mocked(storage.read).mockRejectedValueOnce(new Error('不可用'))
    persistence = startPlayerPersistence(storage)
    await persistence.ready
    player.setVolume(0.6)
    flush()
    await vi.advanceTimersByTimeAsync(500)
    expect(player.audio.volume).toBe(0.6)
    expect(storage.write).toHaveBeenLastCalledWith({ volume: 0.6 })
    expect(warn).toHaveBeenCalledTimes(1)
  })
})
