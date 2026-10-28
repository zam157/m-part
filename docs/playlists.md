# 收藏歌单

侧栏「我的歌单」进入 `/playlists`。选择音源后，读取当前浏览器账号，展示自己创建与收藏的歌单；BiliBili 对应自己的收藏夹和收藏的他人收藏夹。只读远端收藏，不会修改平台上的歌单。

## Provider 接口

- `getCurrentUser(): Promise<ProviderUser | null>`：读取真实登录状态；仅未登录返回 `null`，网络失败和风控仍抛错。
- `getPlaylists(userId, page): Promise<CollectionPage<PlaylistInfo>>`：从第 1 页开始，返回歌单元数据与 `hasMore`。
- `getPlaylist(id, page): Promise<CollectionPage<MusicInfo>>`：读取曲目，复用现有播放器。与本地 `playQueue` 无关。
- `getAllPlaylistTracks(id, options?): Promise<MusicInfo[]>`：音源可选的整单曲目能力；`options` 支持 `knownItems` 复用资料、`onProgress` 累计有序结果和 `signal` 取消请求。未实现的音源仍按 `getPlaylist` 分页读取。

歌单列表及曲目都用「加载更多」追加，按 ID 去重；刷新歌单会重新识别账号并清空旧账号内容。切换音源时忽略旧请求的迟到响应；详情卸载后不再提交在途结果。歌单列表的状态在模块级信号保存，往返页面不重复加载，切换音源或手动刷新会重新取数。

| 音源 | 接口与分页 |
| --- | --- |
| BiliBili | `/x/web-interface/nav` 读取账号；第 1 页将 `/x/v3/fav/folder/created/list-all` 自己的收藏夹与 `/x/v3/fav/folder/collected/list` 收藏的他人歌单合并；后续页只继续读取后者，每页 20 条 |
| BiliBili 曲目 | `/x/v3/fav/resource/list`，`media_id` 为歌单 ID，按 `has_more` 翻页；过滤非视频和失效稿件，使用 `bvid` 进入现有音频播放链路 |
| 网易云 | `/weapi/w/nuser/account/get` 读取账号；`/weapi/user/playlist` 使用该账号 UID，`offset` / `limit: 20` 分页，按 creator 标记创建与收藏 |
| 网易云曲目 | 浏览时每页 20 首；整单播放通过 `getAllPlaylistTracks` 一次取得完整 `trackIds`，再每批最多 1000 个 ID 请求 `/weapi/v3/song/detail`，保留歌单顺序并跳过平台未返回的歌曲 |

网易云接口参考 [api-enhanced](https://github.com/NeteaseCloudMusicApiEnhanced/api-enhanced/tree/main/module) 的 `login_status`、`user_playlist`、`playlist_detail` 与 `song_detail`，加密和取数均在浏览器内实现。

## 登录与播放

登录凭据由 `credentials: 'include'` 携带，不需要粘贴 Cookie。网易云 WEAPI 需要 CSRF 参数，因此 manifest 新增 `cookies` 权限，仅按固定 URL / 名称读取 `__csrf`，不读取或持久化登录 Cookie。修改权限后必须重新加载扩展。

未登录或凭据过期时展示官方登录入口和「我已登录，刷新」；网络错误与风控展示错误和重试，不能当成未登录或空收藏。平台可能因隐私、版权、会员或下架限制拒绝读取或播放，沿用现有错误提示。

详情支持逐首点击，立即加入队列并播放；「一键播放」优先调用 Provider 的整单接口，没有该能力时自动读取尚未加载的全部曲目页。读取期间显示当前曲目数，合并重复点击；全部成功后按原顺序去重，替换播放队列并播放第一首。失败保留当前播放；网易云重试时复用已完成批次的资料，重新确认 ID 列表后只查询仍缺失的曲目，分页回退则从失败页继续。离开详情会取消网易云整单请求，停止后续取数和队列更新。「加载更多歌曲」仍可用于手动浏览。

网易云每次整单调用的资料请求数为 `1 + ceil(缺失曲目数 / 1000)`：1 次歌单详情，加若干次批量歌曲详情；首屏浏览此前发生的请求另计。不再为了整单播放按 20 首重复拉取歌单详情。`/playlist/track/all` 是参考库的组合封装，不是网易云原生接口；本项目直接调用官方 WEAPI。

真实接口验证：5468 首公开歌单完整返回 5468 首，资料请求为 1 次歌单详情 + 6 次歌曲详情；58 首歌单从首屏点击一键播放，新增 2 次资料请求后队列为 58 首，播放进度正常。音频地址请求另计。

整单读取只获取曲目资料；实际音频仍在轮到该曲时按需缓冲，不会预下载整个歌单的音频文件。若已加载全部曲目，直接复用已有结果。

## 公开歌单搜索

搜索页选择「网易云 → 歌单」，通过 `Provider.searchPlaylist(keyword, page)` 搜索公开歌单，返回 `[PlaylistInfo[], Pagination]`。网易云沿用 `/weapi/cloudsearch/pc`，`type: 1000`、`limit: 20`、`offset: (page - 1) * 20`，映射 `result.playlists` 与 `result.playlistCount`；不先调用账号接口，也不要求用户已收藏该歌单。参数参考上游 [cloudsearch](https://github.com/NeteaseCloudMusicApiEnhanced/api-enhanced/blob/main/module/cloudsearch.js)。

公开搜索结果不推断 `owned`，只显示封面、标题、创建者及曲目数，标题按普通文本渲染。打开结果复用 `/playlist-detail/:provider/:id`，查询串 `from=search` 让返回按钮与侧栏选中状态指向搜索；返回后沿用模块级搜索状态，保留关键词、结果与页码。

搜索类型按音源能力启用，当前只有网易云声明 `searchPlaylist`；BiliBili 的歌单搜索为禁用状态，收藏夹浏览仍然可用。由网易云歌单搜索切到不支持该能力的音源时自动重置为歌曲，并清空旧结果及分页，忽略在途迟到响应。

实测无需登录即可搜索「纯音乐」，打开真实结果并翻到后续曲目页、使用官方 URL 播放、返回搜索与翻页。接口可用性和曲目播放权限以平台当前返回为准。

## 有登录凭据的浏览器中验证

1. 加载最新扩展；现有扩展点「重新加载」，确认新增 `cookies` 权限生效。
2. 在同一浏览器配置中登录网易云 / BiliBili 官方站点。MCP 的测试 profile 与日常浏览器不共享凭据。
3. 打开「我的歌单」，分别选择音源，点击「刷新歌单」。确认账号名正确、创建和收藏列表符合平台实际数据。
4. 打开超过 20 首的歌单，检查第一页、加载更多的顺序和数量；测试 BiliBili 含失效视频的收藏夹及网易云大歌单。
5. 点击曲目确认加入播放队列并开始播放；不手动翻页直接点「一键播放」，确认读取完整歌单后队列包含全部可用曲目，再测试切换音源后继续播放。
6. 在平台切换账号后刷新，确认没有旧账号的歌单残留；退出登录后刷新应回到登录提示。断网、恢复后检查错误与重试。

自动检查覆盖账号识别、CSRF、歌单映射、曲目分页、过期凭据、跨音源迟到响应、刷新与清理。当前 MCP profile 无登录态：收藏列表的登录后分支使用模拟响应验证，可播放歌曲另外使用官方音频地址检查播放。用户已确认自己的登录账号收藏能正常展示并播放；公开歌单搜索与曲目播放则在 MCP 的未登录环境中使用真实接口验证。

QQ 音乐已接入相同的收藏歌单、公开搜索和整单播放流程；会话字段、接口与登录后验证见 [QQ 音乐音源](./qq.md)。

## 本地歌单

「我的歌单」默认展示本地歌单，切换「平台歌单」仍可浏览各音源账号的收藏。本地歌单无需登录，支持新建、重命名、删除以及逐首移除；点击曲目加入队列播放，「一键播放」将整个歌单交给现有播放器，也遵守一起听的房主 / 管理员权限。

首页推荐、搜索结果和歌单曲目的右键菜单提供「添加到本地歌单」：可选择已有歌单，或直接新建并添加；同一歌单按 `provider + id` 去重，允许混合不同音源。选择器内显示「已添加」，明确展示写入成功和失败。分 P 容器保留原曲目身份，逐首播放时继续使用 Provider 的通用分段选择；添加已解析的分 P 曲目则保留其独立 ID。

数据通过 IndexedDB 数据库 `mpart-local-playlists` 的 `playlists` store 保存在当前浏览器 / 扩展配置中，刷新和重启后恢复。每次变更在一个读写事务中读取最新歌单并提交，多窗口同时添加不会覆盖其他窗口的数据；进入列表、详情和添加弹窗时重新读取。写入成功后才更新内存状态，存储失败显示可重试错误，不把未保存的数据显示为成功。与个人播放队列缓存隔离，不上传到平台；清除站点 / 扩展数据或卸载扩展可能丢失歌单。

只缓存曲目资料，沿用播放器的字段白名单与校验，不保存 `src`、歌词 URL、临时音频地址、Cookie 或媒体票据。歌单缓存不等于离线下载，播放时仍由原 Provider 按需取源并受平台权限限制。

实现位置：`utils/local-playlist-storage.ts` 为存储与资料校验，`composables/local-playlists.ts` 为共享状态和写入队列，`LocalPlaylistDialog/` 为右键添加与管理弹窗，`LocalPlaylists/` 与 `/local-playlist/:id` 为列表和详情。文件路由声明由构建自动生成。
