# 收藏歌单

侧栏「我的歌单」进入 `/playlists`。选择音源后，读取当前浏览器账号，展示自己创建与收藏的歌单；BiliBili 对应自己的收藏夹和收藏的他人收藏夹。只读远端收藏，不会修改平台上的歌单。

## Provider 接口

- `getCurrentUser(): Promise<ProviderUser | null>`：读取真实登录状态；仅未登录返回 `null`，网络失败和风控仍抛错。
- `getPlaylists(userId, page): Promise<CollectionPage<PlaylistInfo>>`：从第 1 页开始，返回歌单元数据与 `hasMore`。
- `getPlaylist(id, page): Promise<CollectionPage<MusicInfo>>`：读取曲目，复用现有播放器。与本地 `playQueue` 无关。

歌单列表及曲目都用「加载更多」追加，按 ID 去重；刷新歌单会重新识别账号并清空旧账号内容。切换音源时忽略旧请求的迟到响应；详情卸载后不再提交在途结果。歌单列表的状态在模块级信号保存，往返页面不重复加载，切换音源或手动刷新会重新取数。

| 音源 | 接口与分页 |
| --- | --- |
| BiliBili | `/x/web-interface/nav` 读取账号；第 1 页将 `/x/v3/fav/folder/created/list-all` 自己的收藏夹与 `/x/v3/fav/folder/collected/list` 收藏的他人歌单合并；后续页只继续读取后者，每页 20 条 |
| BiliBili 曲目 | `/x/v3/fav/resource/list`，`media_id` 为歌单 ID，按 `has_more` 翻页；过滤非视频和失效稿件，使用 `bvid` 进入现有音频播放链路 |
| 网易云 | `/weapi/w/nuser/account/get` 读取账号；`/weapi/user/playlist` 使用该账号 UID，`offset` / `limit: 20` 分页，按 creator 标记创建与收藏 |
| 网易云曲目 | `/weapi/v6/playlist/detail` 的 `tracks` 可能被截断，使用完整 `trackIds` 每页 20 个 ID 请求 `/weapi/v3/song/detail`，保留歌单顺序并跳过平台未返回的下架歌曲 |

网易云接口参考 [api-enhanced](https://github.com/NeteaseCloudMusicApiEnhanced/api-enhanced/tree/main/module) 的 `login_status`、`user_playlist`、`playlist_detail` 与 `song_detail`，加密和取数均在浏览器内实现。

## 登录与播放

登录凭据由 `credentials: 'include'` 携带，不需要粘贴 Cookie。网易云 WEAPI 需要 CSRF 参数，因此 manifest 新增 `cookies` 权限，仅按固定 URL / 名称读取 `__csrf`，不读取或持久化登录 Cookie。修改权限后必须重新加载扩展。

未登录或凭据过期时展示官方登录入口和「我已登录，刷新」；网络错误与风控展示错误和重试，不能当成未登录或空收藏。平台可能因隐私、版权、会员或下架限制拒绝读取或播放，沿用现有错误提示。

详情支持逐首点击，立即加入队列并播放；「播放已加载歌曲」以当前已加载曲目替换播放队列，不会静默下载整个大型歌单。想加入更多曲目时先点「加载更多歌曲」。

## 有登录凭据的浏览器中验证

1. 加载最新扩展；现有扩展点「重新加载」，确认新增 `cookies` 权限生效。
2. 在同一浏览器配置中登录网易云 / BiliBili 官方站点。MCP 的测试 profile 与日常浏览器不共享凭据。
3. 打开「我的歌单」，分别选择音源，点击「刷新歌单」。确认账号名正确、创建和收藏列表符合平台实际数据。
4. 打开超过 20 首的歌单，检查第一页、加载更多的顺序和数量；测试 BiliBili 含失效视频的收藏夹及网易云大歌单。
5. 点击曲目确认加入播放队列并开始播放；测试「播放已加载歌曲」及切换音源后继续播放。
6. 在平台切换账号后刷新，确认没有旧账号的歌单残留；退出登录后刷新应回到登录提示。断网、恢复后检查错误与重试。

自动检查覆盖账号识别、CSRF、歌单映射、曲目分页、过期凭据、跨音源迟到响应、刷新与清理。当前 MCP profile 无登录态：仅实测未登录路径，登录后列表与分页使用模拟响应验证，真实账号收藏需在上述步骤中验证；模拟返回的可播放歌曲另外使用官方音频地址检查播放。
