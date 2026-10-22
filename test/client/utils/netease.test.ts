import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { requestMock, encryptMock } = vi.hoisted(() => ({ requestMock: vi.fn(), encryptMock: vi.fn() }))
vi.mock('#shared/utils/fetch', () => ({ tRequest: requestMock }))
vi.mock('#shared/utils/providers/netease-crypto', () => ({ encryptWeapi: encryptMock }))
const { default: provider } = await import('#shared/utils/providers/netease')

const album = { id: 10, name: '专辑', picUrl: 'http://p1.music.126.net/cover.jpg', artist: { id: 7, name: '歌手' } }
const song = { id: 1, name: '歌曲', dt: 180500, ar: [{ id: 7, name: '歌手' }], al: album }
const music = { provider: 'netease' as const, id: '1', title: '歌曲', duration: 180.5, coverUrl: '' }

describe('网易云 Provider', () => {
  beforeEach(() => {
    requestMock.mockReset()
    encryptMock.mockReset().mockReturnValue({ params: 'encrypted+/=', encSecKey: 'rsa' })
  })
  afterEach(() => vi.restoreAllMocks())

  it('歌词复用 WEAPI 加密，返回原文 / 翻译 / 音译，并传递取消信号', async () => {
    requestMock.mockResolvedValueOnce([true, { code: 200, lrc: { lyric: '[00:01]Hello' }, tlyric: { lyric: '[00:01]你好' }, romalrc: { lyric: '[00:01]he-llo' } }])
    const controller = new AbortController()
    expect(await provider.getLyrics!('1', { signal: controller.signal })).toEqual({ original: '[00:01]Hello', translated: '[00:01]你好', romanized: '[00:01]he-llo', instrumental: false })
    expect(encryptMock).toHaveBeenCalledWith({ id: '1', cp: false, tv: 0, lv: 0, rv: 0, kv: 0, yv: 0, ytv: 0, yrv: 0, csrf_token: '' })
    expect(requestMock).toHaveBeenCalledWith('https://music.163.com/weapi/song/lyric/v1', expect.objectContaining({ signal: controller.signal }))
  })

  it('新版歌词保留普通 LRC 回退和逐字时间轴对应的翻译、音译', async () => {
    const wordByWord = { original: '[1000,1000](1000,500,0)你(1500,500,0)好', translated: '[00:01]Hello', romanized: '[00:01]ni hao' }
    requestMock.mockResolvedValueOnce([true, { code: 200, lrc: { lyric: '[00:02]你好' }, yrc: { lyric: wordByWord.original }, ytlrc: { lyric: wordByWord.translated }, yromalrc: { lyric: wordByWord.romanized } }])
    expect(await provider.getLyrics!('1')).toMatchObject({ original: '[00:02]你好', wordByWord })
  })

  it('歌词区分纯音乐、无歌词和失败，不请求已取消的任务', async () => {
    requestMock.mockResolvedValueOnce([true, { code: 200, nolyric: true }])
    expect(await provider.getLyrics!('1')).toMatchObject({ original: '', instrumental: true })
    requestMock.mockResolvedValueOnce([true, { code: 200 }])
    expect(await provider.getLyrics!('2')).toMatchObject({ original: '', instrumental: false })
    requestMock.mockResolvedValueOnce([true, { code: 500, message: '歌词服务异常' }])
    await expect(provider.getLyrics!('3')).rejects.toThrow('歌词服务异常')
    const count = requestMock.mock.calls.length
    await expect(provider.getLyrics!('1', { signal: AbortSignal.abort() })).rejects.toThrow()
    expect(requestMock).toHaveBeenCalledTimes(count)
  })

  it('推荐新歌使用公开 WEAPI 接口，并展开嵌套的 song 字段', async () => {
    requestMock.mockResolvedValue([true, { code: 200, result: [{ id: 99, name: '推荐卡片', song }] }])
    expect(await provider.getRecommendations!()).toEqual([expect.objectContaining({ provider: 'netease', id: '1', title: '歌曲', duration: 180.5, artist: '歌手', coverUrl: 'https://p1.music.126.net/cover.jpg' })])
    expect(encryptMock).toHaveBeenCalledWith({ type: 'recommend', limit: 20, areaId: 0, csrf_token: '' })
    expect(requestMock).toHaveBeenCalledWith('https://music.163.com/weapi/personalized/newsong', expect.objectContaining({ method: 'POST', body: expect.any(URLSearchParams) }))
  })

  it('推荐为空和业务失败分别处理', async () => {
    requestMock.mockResolvedValueOnce([true, { code: 200, result: [] }])
    expect(await provider.getRecommendations!()).toEqual([])
    requestMock.mockResolvedValueOnce([true, { code: 301, message: '暂不可用' }])
    await expect(provider.getRecommendations!()).rejects.toThrow('暂不可用')
  })

  it('歌曲搜索转换毫秒时长和封面，并按页计算 offset', async () => {
    requestMock.mockResolvedValue([true, { code: 200, result: { songs: [song], songCount: 41 } }])
    const [songs, page] = await provider.search!('关键词', 2)
    expect(encryptMock).toHaveBeenCalledWith(expect.objectContaining({ s: '关键词', type: 1, offset: 20, limit: 20 }))
    expect(requestMock).toHaveBeenCalledWith('https://music.163.com/weapi/cloudsearch/pc', expect.objectContaining({ method: 'POST', body: expect.any(URLSearchParams) }))
    expect(songs[0]).toMatchObject({ provider: 'netease', id: '1', duration: 180.5, artist: '歌手', album: '专辑', coverUrl: 'https://p1.music.126.net/cover.jpg' })
    expect(page).toEqual({ page: 2, pageSize: 20, total: 41 })
  })

  it('支持旧字段形式的歌曲响应', async () => {
    requestMock.mockResolvedValue([true, { code: 200, result: { songs: [{ id: 1, name: '歌曲', duration: 3000, artists: song.ar, album }], songCount: 1 } }])
    expect((await provider.search!('test', 1))[0][0]).toMatchObject({ duration: 3, artist: '歌手', album: '专辑' })
  })

  it('不查询登录账号即可搜索公开歌单，保留元数据与真实总数', async () => {
    requestMock.mockResolvedValueOnce([true, { code: 200, result: { playlists: [{
      id: 42, name: '<em>纯音乐</em>', coverImgUrl: '//p1.music.126.net/playlist.jpg',
      trackCount: 58, creator: { userId: 7, nickname: '创建者' }, description: '公开歌单',
    }], playlistCount: 558 } }])
    const [items, page] = await provider.searchPlaylist!('纯音乐', 2)
    expect(items).toEqual([{ provider: 'netease', id: '42', title: '<em>纯音乐</em>', coverUrl: 'https://p1.music.126.net/playlist.jpg', totalTracks: 58, creator: '创建者', description: '公开歌单' }])
    expect(items[0]?.owned).toBeUndefined()
    expect(page).toEqual({ page: 2, pageSize: 20, total: 558 })
    expect(encryptMock).toHaveBeenCalledWith(expect.objectContaining({ s: '纯音乐', type: 1000, offset: 20, limit: 20 }))
    expect(requestMock).toHaveBeenCalledTimes(1)
    expect(requestMock).toHaveBeenCalledWith('https://music.163.com/weapi/cloudsearch/pc', expect.anything())
  })

  it('公开歌单搜索区分空结果和请求失败', async () => {
    requestMock.mockResolvedValueOnce([true, { code: 200, result: {} }])
    expect(await provider.searchPlaylist!('无结果', 1)).toEqual([[], { page: 1, pageSize: 20, total: 0 }])
    requestMock.mockRejectedValueOnce(new Error('网络异常'))
    await expect(provider.searchPlaylist!('纯音乐', 1)).rejects.toThrow('网络异常')
  })

  it('没有结果时返回空分页，不把业务失败当成空结果', async () => {
    requestMock.mockResolvedValueOnce([true, { code: 200, result: {} }])
    expect(await provider.search!('none', 1)).toEqual([[], { page: 1, pageSize: 20, total: 0 }])
    requestMock.mockResolvedValueOnce([true, { code: 301, message: '需要登录' }])
    await expect(provider.search!('test', 1)).rejects.toThrow('需要登录')
    requestMock.mockResolvedValueOnce([false, 503, 'Unavailable'])
    await expect(provider.search!('test', 1)).rejects.toThrow('503 Unavailable')
  })

  it('歌手和专辑搜索映射到共用详情数据', async () => {
    requestMock.mockResolvedValueOnce([true, { code: 200, result: { artists: [{ id: 7, name: '歌手', img1v1Url: '//p1.music.126.net/artist.jpg' }], artistCount: 1 } }])
    expect((await provider.searchArtist!('歌手', 1))[0][0]).toMatchObject({ provider: 'netease', id: '7', name: '歌手', coverUrl: 'https://p1.music.126.net/artist.jpg' })
    requestMock.mockResolvedValueOnce([true, { code: 200, result: { albums: [album], albumCount: 1 } }])
    expect((await provider.searchAlbum!('专辑', 1))[0][0]).toMatchObject({ id: '10', title: '专辑', extra: { title: '专辑', artist: '歌手', cover: 'https://p1.music.126.net/cover.jpg' } })
    expect(encryptMock.mock.calls.map(([data]) => data.type)).toEqual([100, 10])
  })

  it('播放只使用目标歌曲的官方 URL，并标识试听', async () => {
    requestMock.mockResolvedValue([true, { code: 200, data: [{ id: 2, url: 'https://other', code: 200 }, { id: 1, url: 'http://m1.music.126.net/song.mp3', code: 200, br: 128000, freeTrialInfo: { start: 0, end: 30 } }] }])
    expect(await provider.getSourceInfo!(music)).toMatchObject({ url: 'https://m1.music.126.net/song.mp3', qualities: [{ name: '试听', url: 'https://m1.music.126.net/song.mp3' }] })
  })

  it.each([{ code: -110, url: null }, { code: 404, url: null }, { code: 200, url: null }])('没有可播放 URL 时明确报错（$code）', async (source) => {
    requestMock.mockResolvedValue([true, { code: 200, data: [{ id: 1, ...source }] }])
    await expect(provider.getSourceInfo!(music)).rejects.toThrow('网易云暂未提供可播放音源')
  })

  it('专辑曲目本地分页，并在歌曲缺少专辑信息时补全封面', async () => {
    const songs = Array.from({ length: 23 }, (_, id) => ({ id, name: `Track ${id}`, dt: 1000, ar: song.ar }))
    requestMock.mockResolvedValue([true, { code: 200, album, songs }])
    const [tracks, page] = await provider.getAlbumWorks!('10', 2, {})
    expect(tracks.map(track => track.id)).toEqual(['20', '21', '22'])
    expect(tracks[0]?.coverUrl).toBe('https://p1.music.126.net/cover.jpg')
    expect(page.total).toBe(23)
  })
})
