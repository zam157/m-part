import { afterEach, describe, expect, it, vi } from 'vitest'
import { createPlayerCacheWriter, decodePlayerCache, queueForStorage } from '~/utils/player-storage'
import type { PlayerCache, PlayerStorage } from '~/utils/player-storage'

const song = { provider: 'netease' as const, id: '1', title: '歌曲', duration: 120, coverUrl: 'https://example.com/cover.jpg', src: 'blob:expired', lrcUrl: 'https://example.com/temporary' }
function storage(): PlayerStorage {
  return { read: vi.fn().mockResolvedValue({}), write: vi.fn().mockResolvedValue(undefined), close: vi.fn() }
}
afterEach(() => vi.useRealTimers())

describe('播放器缓存合并写入', () => {
  it('连续音量和进度更新按固定窗口合并，不访问数据库读取且不重写队列', async () => {
    vi.useFakeTimers()
    const db = storage()
    const writer = createPlayerCacheWriter(db, vi.fn())
    writer.schedule({ queue: queueForStorage([song], 'order', null), position: { song, time: 0 } }, 200)
    await vi.advanceTimersByTimeAsync(200)
    expect(db.write).toHaveBeenCalledTimes(1)
    for (let i = 1; i <= 100; i++) {
      writer.schedule({ volume: i / 100, position: { song, time: i } }, 500)
      await vi.advanceTimersByTimeAsync(4)
    }
    expect(db.write).toHaveBeenCalledTimes(1)
    await vi.advanceTimersByTimeAsync(100)
    expect(db.write).toHaveBeenLastCalledWith({ volume: 1, position: { song, time: 100 } })
    expect(db.write).toHaveBeenCalledTimes(2)
    for (let i = 1; i <= 100; i++) {
      writer.schedule({ position: { song, time: i } }, 5000)
      await vi.advanceTimersByTimeAsync(40)
    }
    expect(db.write).toHaveBeenCalledTimes(2)
    await vi.advanceTimersByTimeAsync(1000)
    expect(db.write).toHaveBeenLastCalledWith({ position: { song, time: 100 } })
    expect(db.read).not.toHaveBeenCalled()
    writer.dispose()
  })

  it('慢事务期间只保留后续最新值，显式补存等候前一事务完成', async () => {
    const db = storage()
    let finish!: () => void
    vi.mocked(db.write).mockReturnValueOnce(new Promise(resolve => { finish = resolve }))
    const writer = createPlayerCacheWriter(db, vi.fn())
    writer.schedule({ volume: 0.2 }, 500)
    const first = writer.flush()
    await Promise.resolve()
    writer.schedule({ volume: 0.5 }, 500)
    const second = writer.flush()
    writer.schedule({ volume: 0.8 }, 500)
    expect(db.write).toHaveBeenCalledTimes(1)
    finish()
    await Promise.all([first, second])
    expect(db.write).toHaveBeenCalledTimes(2)
    expect(db.write).toHaveBeenLastCalledWith({ volume: 0.8 })
    writer.dispose()
  })

  it('写入失败保留脏数据并限频重试，新值不会被失败的旧值覆盖', async () => {
    vi.useFakeTimers()
    const db = storage()
    const onError = vi.fn()
    vi.mocked(db.write).mockRejectedValueOnce(new Error('写入失败'))
    const writer = createPlayerCacheWriter(db, onError)
    writer.schedule({ volume: 0.2 }, 500)
    await writer.flush()
    expect(onError).toHaveBeenCalledTimes(1)
    expect(db.write).toHaveBeenCalledTimes(1)
    writer.schedule({ volume: 0.7 }, 500)
    await vi.advanceTimersByTimeAsync(500)
    expect(db.write).toHaveBeenLastCalledWith({ volume: 0.7 })
    writer.dispose()
    await vi.runAllTimersAsync()
    expect(db.write).toHaveBeenCalledTimes(2)
  })
})

describe('播放器缓存资料校验', () => {
  it('QQ 曲目与当前位置可恢复，临时音频地址仍不保存', () => {
    const item = { ...song, provider: 'qq' as const, id: 'qq-mid' }
    const queue = queueForStorage([item], 'random', [0])
    expect(decodePlayerCache({ queue, position: { song: item, time: 42 } })).toMatchObject({
      queue: { items: [expect.objectContaining({ provider: 'qq', id: 'qq-mid' })], randomOrder: [0] },
      position: { song: { provider: 'qq', id: 'qq-mid' }, time: 42 },
    })
    expect(queue.items[0]).not.toHaveProperty('src')
  })
  it('只保存曲目资料，剔除临时音频及歌词 URL', () => {
    const queue = queueForStorage([song], 'random', [0])
    expect(queue.items[0]).not.toHaveProperty('src')
    expect(queue.items[0]).not.toHaveProperty('lrcUrl')
    expect(decodePlayerCache({ queue }).queue).toEqual(queue)
  })

  it('过滤异常曲目和重复身份，修复越界音量、进度与随机顺序', () => {
    const raw: PlayerCache = {
      queue: { items: [song, song, { ...song, provider: 'unknown' } as never], playMode: 'random', randomOrder: [3, 1, 1] },
      position: { song, time: Number.NaN }, volume: 2,
    }
    const result = decodePlayerCache(raw)
    expect(result.queue?.items).toHaveLength(1)
    expect(result.queue?.randomOrder).toBeNull()
    expect(result.position).toEqual({ song: { provider: 'netease', id: '1' }, time: 0 })
    expect(result.volume).toBe(1)
    expect(decodePlayerCache(null)).toEqual({})
  })
})
