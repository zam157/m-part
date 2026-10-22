import { beforeEach, describe, expect, it, vi } from 'vitest'
const { request, session } = vi.hoisted(() => ({ request: vi.fn(), session: vi.fn() }))
vi.mock('#shared/utils/fetch', () => ({ tRequest: request }))
vi.mock('#shared/utils/providers/qq-session', () => ({ getQQSession: session }))
const { default: provider } = await import('#shared/utils/providers/qq')
const singer = { mid: 'artist-mid', name: '歌手' }
const album = { mid: 'album-mid', name: '专辑', pmid: 'album-mid_1' }
const track = { mid: 'song-mid', title: '歌曲', interval: 123, singer: [singer], album, file: { media_mid: 'media-mid' }, type: 0 }
const ok = (data: unknown, code = 0) => [true, { code: 0, req_0: { code, data } }]
const json = (data: object) => [true, { code: 0, ...data }]
const music = { provider: 'qq' as const, id: 'song-mid', title: '歌曲', duration: 123, coverUrl: '' }

beforeEach(() => {
  request.mockReset()
  session.mockReset().mockResolvedValue({ uin: '0', key: '', token: 5381 })
})

describe('QQ 音乐 Provider', () => {
  it('旧 CGI 搜歌保留歌曲 MID、秒数和专辑封面，正确分页且不传失效的 new_json', async () => {
    request.mockResolvedValue(json({ data: { song: { totalnum: 41, list: [{ songmid: 'song-mid', songname: '歌曲', interval: 123, singer: [singer], albummid: 'album-mid', albumname: '专辑' }] } } }))
    const [items, page] = await provider.search!('关键词', 2)
    expect(items).toEqual([expect.objectContaining({ provider: 'qq', id: 'song-mid', title: '歌曲', duration: 123, artist: '歌手', album: '专辑', coverUrl: 'https://y.gtimg.cn/music/photo_new/T002R300x300M000album-mid.jpg' })])
    expect(page).toEqual({ page: 2, pageSize: 20, total: 41 })
    expect(request).toHaveBeenCalledWith('https://c.y.qq.com/soso/fcgi-bin/client_search_cp', expect.objectContaining({ searchParams: expect.objectContaining({ w: '关键词', p: 2, n: 20, t: 0, g_tk: 5381 }) }))
    expect(request.mock.calls[0]![1].searchParams).not.toHaveProperty('new_json')
  })
  it('歌手和专辑使用已验证的 PC RPC 参数，RPC 层错误不能冒充空结果', async () => {
    request.mockResolvedValueOnce(ok({ body: { singer: { list: [{ singerMID: 'artist-mid', singerName: '歌手', singerPic: 'http://y.gtimg.cn/artist.jpg' }] } }, meta: { sum: 22 } }))
    expect((await provider.searchArtist!('歌手', 2))[0][0]).toMatchObject({ provider: 'qq', id: 'artist-mid', name: '歌手', coverUrl: 'https://y.gtimg.cn/artist.jpg' })
    expect(request.mock.calls[0]![1].body).toMatchObject({ comm: { ct: 19, cv: 1859 }, req_0: { module: 'music.search.SearchCgiService', method: 'DoSearchForQQMusicDesktop', param: { page_num: 2, num_per_page: 20, search_type: 1 } } })
    request.mockResolvedValueOnce(ok({ body: { album: { list: [{ albumMID: 'album-mid', albumName: '专辑', singerName: '歌手', publicTime: '2026-01-01', song_count: 12 }] } }, meta: { sum: 1 } }))
    expect((await provider.searchAlbum!('专辑', 1))[0][0]).toMatchObject({ provider: 'qq', id: 'album-mid', title: '专辑', totalTracks: 12 })
    request.mockResolvedValueOnce(ok({}, 2001))
    await expect(provider.searchArtist!('失败', 1)).rejects.toThrow('2001')
  })
  it('公开歌单搜索不读取登录账号，索引从 0 开始，推荐转换现代曲目', async () => {
    request.mockResolvedValueOnce(json({ data: { sum: 100, list: [{ dissid: '42', dissname: '歌单', imgurl: 'http://p.qpic.cn/cover.jpg', song_count: 200, creator: { name: '创建者' } }] } }))
    const [items, page] = await provider.searchPlaylist!('歌单', 2)
    expect(items[0]).toMatchObject({ provider: 'qq', id: '42', totalTracks: 200, creator: '创建者', coverUrl: 'https://p.qpic.cn/cover.jpg' })
    expect(items[0]).not.toHaveProperty('owned')
    expect(page.total).toBe(100)
    expect(request.mock.calls[0]![1].searchParams).toMatchObject({ page_no: 1, num_per_page: 20 })
    request.mockResolvedValueOnce(ok({ songlist: [track] }))
    expect((await provider.getRecommendations!())[0]).toMatchObject({ provider: 'qq', id: 'song-mid', coverUrl: 'https://y.gtimg.cn/music/photo_new/T002R300x300M000album-mid_1.jpg' })
  })
  it('VKey 复用浏览器会话和媒体 MID，仅暴露实际有 purl 的音质', async () => {
    session.mockResolvedValue({ uin: '123', key: 'session-key', token: 77 })
    request.mockResolvedValueOnce(ok({ track_info: track })).mockResolvedValueOnce(ok({ sip: ['http://isure.stream.qqmusic.qq.com/'], midurlinfo: [
      { songmid: 'song-mid', filename: 'M800song-midmedia-mid.mp3', purl: '' },
      { songmid: 'other-mid', filename: 'M800song-midmedia-mid.mp3', purl: 'wrong.mp3' },
      { songmid: 'song-mid', filename: 'M500song-midmedia-mid.mp3', purl: 'M500media-mid.mp3?vkey=allowed' },
      { songmid: 'song-mid', filename: 'C400media-mid.m4a', purl: 'C400media-mid.m4a?vkey=allowed' },
    ] }))
    const result = await provider.getSourceInfo!(music)
    expect(result.qualities?.map(item => item.name)).toEqual(['128K', 'AAC'])
    expect(result.url).toBe('https://isure.stream.qqmusic.qq.com/M500media-mid.mp3?vkey=allowed')
    expect(request.mock.calls[1]![1].body).toMatchObject({ comm: { uin: '123', authst: 'session-key', auth_tkn: 77 }, req_0: { module: 'vkey.GetVkeyServer', param: { songmid: ['song-mid', 'song-mid', 'song-mid'], filename: ['M800song-midmedia-mid.mp3', 'M500song-midmedia-mid.mp3', 'C400media-mid.m4a'] } } })
    expect(request.mock.calls[1]![1].headers).not.toHaveProperty('cookie')
  })
  it('无授权播放地址和返回错误歌曲时明确失败，不拼接无 vkey 的地址', async () => {
    request.mockResolvedValueOnce(ok({ track_info: track })).mockResolvedValueOnce(ok({ sip: ['https://isure.stream.qqmusic.qq.com/'], midurlinfo: [] }))
    await expect(provider.getSourceInfo!(music)).rejects.toThrow('暂未提供可播放音源')
    request.mockResolvedValueOnce(ok({ track_info: { ...track, mid: 'other' } }))
    await expect(provider.getSourceInfo!(music)).rejects.toThrow('目标歌曲')
  })
  it('用浏览器 base64 和 TextDecoder 解码中文歌词、翻译，并支持取消', async () => {
    const signal = new AbortController().signal
    const encode = (value: string) => btoa(String.fromCharCode(...new TextEncoder().encode(value)))
    request.mockResolvedValueOnce(json({ retcode: 0, lyric: encode('[00:01]歌词'), trans: encode('[00:01]翻译') }))
    expect(await provider.getLyrics!('song-mid', { signal })).toMatchObject({ original: '[00:01]歌词', translated: '[00:01]翻译', instrumental: false })
    expect(request.mock.calls[0]![1].signal).toBe(signal)
    const calls = request.mock.calls.length
    await expect(provider.getLyrics!('song-mid', { signal: AbortSignal.abort() })).rejects.toThrow()
    expect(request).toHaveBeenCalledTimes(calls)
  })
  it('登录账号需由官方校验，缺失或过期 Cookie 返回未登录，网络失败仍报错', async () => {
    expect(await provider.getCurrentUser!()).toBeNull()
    expect(request).not.toHaveBeenCalled()
    session.mockResolvedValue({ uin: '123', key: 'key', token: 77 })
    request.mockResolvedValueOnce(json({ data: { creator: { nick: '用户', headpic: 'http://y.gtimg.cn/avatar.jpg' } } }))
    expect(await provider.getCurrentUser!()).toEqual({ id: '123', name: '用户', coverUrl: 'https://y.gtimg.cn/avatar.jpg' })
    request.mockResolvedValueOnce([true, { code: 1000 }])
    expect(await provider.getCurrentUser!()).toBeNull()
    request.mockRejectedValueOnce(new Error('离线'))
    await expect(provider.getCurrentUser!()).rejects.toThrow('离线')
  })
  it('合并创建与收藏的歌单并去重，保留创建归属和分页', async () => {
    session.mockResolvedValue({ uin: '123', key: 'key', token: 77 })
    request.mockResolvedValueOnce(json({ data: { disslist: [{ tid: 42, diss_name: '我创建的', diss_cover: 'https://cover', song_cnt: 2 }], totoal: 21 } })).mockResolvedValueOnce(json({ data: { cdlist: [{ dissid: 42, dissname: '重复收藏' }, { dissid: 43, dissname: '收藏', songnum: 3 }], totaldiss: 2, has_more: 0 } }))
    expect(await provider.getPlaylists!('123', 1)).toEqual({ items: [expect.objectContaining({ id: '42', title: '我创建的', owned: true }), expect.objectContaining({ id: '43', owned: false })], hasMore: true })
    expect(request.mock.calls[1]![1].searchParams).toMatchObject({ ct: 20, cid: 205360956, reqtype: 3, sin: 0, ein: 19 })
  })
  it('使用收藏接口真实的 totaldiss / has_more 和创建接口的 totoal 计算分页', async () => {
    session.mockResolvedValue({ uin: '123', key: 'key', token: 77 })
    const created = json({ data: { disslist: [{ tid: 0, dirid: 205 }], totoal: 21 } })
    request.mockResolvedValueOnce(created).mockResolvedValueOnce(json({ data: { cdlist: [{ dissid: 43 }], totaldiss: 22, has_more: 1 } }))
    expect(await provider.getPlaylists!('123', 2)).toMatchObject({ items: [expect.objectContaining({ id: '43' })], hasMore: true })
    expect(request.mock.calls[1]![1].searchParams).toMatchObject({ sin: 20, ein: 39 })
    request.mockResolvedValueOnce(created).mockResolvedValueOnce(json({ data: { cdlist: [{ dissid: 44 }], totaldiss: 22 } }))
    expect((await provider.getPlaylists!('123', 2)).hasMore).toBe(true)
    request.mockResolvedValueOnce(created).mockResolvedValueOnce(json({ data: { cdlist: [], totaldiss: 0, has_more: 0 } }))
    expect(await provider.getPlaylists!('123', 2)).toEqual({ items: [], hasMore: false })
  })
  it('分页期间切换登录账号时停止读取，避免混入其他账号的歌单', async () => {
    session.mockResolvedValue({ uin: '456', key: 'key', token: 77 })
    await expect(provider.getPlaylists!('123', 2)).rejects.toThrow('账号已变化')
    expect(request).not.toHaveBeenCalled()
  })
  it('歌单分页、整单批量读取及进度回调遵循服务端范围，分页失败不返回半单', async () => {
    request.mockResolvedValueOnce(json({ cdlist: [{ songlist: [track], song_begin: 20, total_song_num: 22 }] }))
    expect(await provider.getPlaylist!('42', 2)).toMatchObject({ items: [expect.objectContaining({ id: 'song-mid' })], hasMore: true })
    expect(request.mock.calls[0]![1].searchParams).toMatchObject({ song_begin: 20, song_num: 20 })
    request.mockReset().mockResolvedValueOnce(json({ cdlist: [{ songlist: [track], song_begin: 0, total_song_num: 2 }] })).mockResolvedValueOnce(json({ cdlist: [{ songlist: [{ ...track, mid: 'second' }], song_begin: 1, total_song_num: 2 }] }))
    const progress = vi.fn()
    expect((await provider.getAllPlaylistTracks!('42', { onProgress: progress })).map(item => item.id)).toEqual(['song-mid', 'second'])
    expect(progress).toHaveBeenLastCalledWith({ items: expect.any(Array), total: 2 })
    expect(request.mock.calls[0]![1].searchParams.song_num).toBe(1000)
    request.mockReset().mockResolvedValueOnce(json({ cdlist: [{ songlist: [track], song_begin: 0, total_song_num: 2 }] })).mockResolvedValueOnce(json({ cdlist: [{ songlist: [track], song_begin: 0, total_song_num: 2 }] }))
    await expect(provider.getAllPlaylistTracks!('42')).rejects.toThrow('分页不完整')
  })
  it('歌手作品、专辑和专辑曲目映射到共用页面', async () => {
    request.mockResolvedValueOnce(ok({ singer_info: singer, singer_brief: '简介', songlist: [], total_song: 0 }))
    expect(await provider.getArtistInfo!('artist-mid')).toMatchObject({ provider: 'qq', id: 'artist-mid', name: '歌手', description: '简介' })
    request.mockResolvedValueOnce(ok({ singer_info: singer, songlist: [track], total_song: 21 }))
    expect((await provider.getArtistWorks!('artist-mid', 2))[1]).toEqual({ page: 2, pageSize: 20, total: 21 })
    request.mockResolvedValueOnce(ok({ albumList: [{ albumMid: 'album-mid', albumName: '专辑', singerName: '歌手' }], total: 1 }))
    expect((await provider.getArtistAlbums!('artist-mid', 1))[0][0]).toMatchObject({ provider: 'qq', id: 'album-mid', title: '专辑' })
    request.mockResolvedValueOnce(ok({ songList: [{ songInfo: track }], totalNum: 21 }))
    expect((await provider.getAlbumWorks!('album-mid', 2, {}))[0][0]).toMatchObject({ provider: 'qq', id: 'song-mid' })
  })
  it('整单读取中取消后不再请求下一批，也不返回不完整歌单', async () => {
    const controller = new AbortController()
    request.mockResolvedValueOnce(json({ cdlist: [{ songlist: [track], song_begin: 0, total_song_num: 2 }] }))
    await expect(provider.getAllPlaylistTracks!('42', { signal: controller.signal, onProgress: () => controller.abort() })).rejects.toThrow()
    expect(request).toHaveBeenCalledTimes(1)
    expect(request.mock.calls[0]![1].signal).toBe(controller.signal)
  })
  it('HTTP 和业务错误不显示为空结果', async () => {
    request.mockResolvedValueOnce([false, 503, 'Unavailable'])
    await expect(provider.search!('q', 1)).rejects.toThrow('503 Unavailable')
    request.mockResolvedValueOnce([true, { code: 500, message: '请求失败' }])
    await expect(provider.getRecommendations!()).rejects.toThrow('请求失败')
  })
})
