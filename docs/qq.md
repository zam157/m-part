# QQ 音乐音源

`packages/music/src/utils/providers/qq.ts` 实现与现有页面共用的 Provider，音源标识为 `qq`，曲目标识始终使用 **song MID**；数字歌曲 ID、专辑 MID 和文件的 media MID 不能混用。参考 [Rain120/qq-music-api](https://github.com/Rain120/qq-music-api/tree/next) 的官方接口结构，没有引入该库、Axios、Koa、Node.js Buffer 或服务端代理。上游 MIT 许可保留在 [licenses/qq-music-api.txt](./licenses/qq-music-api.txt)。

## 能力及接口

| 能力 | 官方接口 / RPC |
| --- | --- |
| 歌曲搜索 | `c.y.qq.com/soso/fcgi-bin/client_search_cp`，`t=0`，`p` 从 1 开始 |
| 歌手 / 专辑搜索 | `music.search.SearchCgiService.DoSearchForQQMusicDesktop`，`search_type=1/2`，`page_num` 从 1 开始 |
| 公开歌单搜索 | `c.y.qq.com/soso/fcgi-bin/client_music_search_songlist`，`page_no` 从 0 开始 |
| 首页新歌 | `newsong.NewSongServer.get_new_song_info` |
| 歌曲资料 / 播放地址 | `music.pf_song_detail_svr.get_song_detail_yqq` → `vkey.GetVkeyServer.CgiGetVkey` |
| 原文 / 翻译歌词 | `c.y.qq.com/lyric/fcgi-bin/fcg_query_lyric_new.fcg` |
| 账号资料 | `c.y.qq.com/rsc/fcgi-bin/fcg_get_profile_homepage.fcg` |
| 创建 / 收藏歌单 | `fcg_user_created_diss` / `fcg_get_profile_order_asset.fcg` |
| 歌单曲目 / 整单 | `fcg_ucc_getcdinfo_byids_cp.fcg`，`song_begin` / `song_num` |
| 歌手资料、作品、专辑 | `music.web_singer_info_svr.get_singer_detail_info` / `music.musichallAlbum.AlbumListServer.GetAlbumList` |
| 专辑曲目 | `music.musichallAlbum.AlbumSongList.GetAlbumSongList` |

RPC 统一 POST 到 `https://u.y.qq.com/cgi-bin/musicu.fcg`，同时检查顶层 `code` 和 `req_0.code`，不能仅凭 HTTP 200 判断成功。网络、业务错误进入现有错误态，不伪装成空列表。

搜索参数有实际验证过的区别：歌曲 CGI 不传 `new_json=1`，否则可能返回空结果；PC 歌手 / 专辑搜索使用 `ct=19, cv=1859`，普通网页 RPC 使用 `ct=24, cv=0`。不能直接复用参考项目内的固定签名、固定账号或固定 `g_tk`。当前实现的这些端点不需要额外的签名算法。

## 浏览器登录态与扩展权限

- 请求全部经过 `packages/music/src/utils/fetch.ts`，扩展默认使用 `credentials: 'include'`；Referer / Origin 由 [apps/extension/public/rules/qq.json](../apps/extension/public/rules/qq.json) 注入。不要在组件请求接口，也不要手动拼 Cookie、Host、User-Agent 等浏览器管理的请求头。
- `qq-session.ts` 仅从 `https://y.qq.com/` 读取 Cookie：优先 QQ 音乐账号 `qqmusic_uin`，兼容 `uin`、`wxuin`，处理 `o` 和前导零；认证 key 优先 `qqmusic_key`，兼容 `qm_keyst`、`p_skey`、`skey`。用 DJB2 生成 `g_tk` / `auth_tkn`，认证 key 仅放 RPC 请求体，不放 URL。
- 不缓存、持久化或打印 key，不修改 Cookie；每次操作重新读取。账号与 key 不存在时返回未登录，资料 / 收藏接口的认证错误也转为登录提示；网络错误仍显示失败。歌单分页时发现账号变化会停止读取，避免混入其他账号的数据。
- `apps/extension/wxt.config.ts` 声明 `*.y.qq.com`、`*.qqmusic.qq.com`、实际返回的 `aqqmusic.tc.qq.com` 和封面 `y.gtimg.cn` 权限。修改权限或 DNR 后要重新加载扩展，仅刷新页面不会更新 manifest。

## 播放、歌词和完整歌单

先读取目标歌曲的媒体 MID，再向官方 VKey 接口请求 MP3 320K、MP3 128K、AAC 三种文件。只接受目标 song MID 对应且具有有效 `purl` 的条目，用官方返回的 `sip` 构建 HTTPS 地址。音质菜单只展示当前会话确实可用的音质；无播放权限时显示登录 / 会员 / 版权提示，不构造无授权地址，也不通过第三方解析。

播放器沿用原生 Audio 流式缓冲；歌词使用浏览器 `atob` + `Uint8Array` + `TextDecoder` 解码 UTF-8 Base64，交给现有 LRC 解析、跟随和翻译开关。QQ 曲目与位置已纳入 IndexedDB 身份校验，恢复后仍重新请求临时播放地址。

普通歌单分页每页 20 首；`getAllPlaylistTracks` 每次请求最多 1000 首，按实际返回数量续读并报告累计进度。校验 `song_begin` 和空页，避免接口重复首屏时把不完整内容当成整单；请求失败或离开页面时沿用现有取消 / 重试逻辑，成功前不替换播放队列。公开歌单搜索不要求登录；收藏歌单在“我的歌单”选择 QQ 音乐后读取。

收藏列表接口必须传 `ct=20, cid=205360956, reqtype=3`：`cid` 是接口路由 ID，不能写成歌单分类 `3`，否则现网会返回 HTTP 200 的空正文，触发 JSON 解析错误。创建列表的总数字段实际拼作 `totoal`，收藏列表使用 `totaldiss` / `has_more`。分页按原始列表数量计算，再过滤没有有效歌单 ID 的系统目录，不能用过滤后的数量判断结束。

## 验证和限制

自动测试覆盖搜索分页与映射、RPC / HTTP 错误、Cookie 优先级与 token、媒体 MID、授权音质过滤、UTF-8 歌词、未登录 / 过期 / 账号变化、创建与收藏去重、整单续读与取消、QQ 播放缓存。

实际扩展已验证匿名歌曲搜索、官方 CDN 播放与暂停、歌词、首页新歌、歌手 / 专辑搜索、歌手资料与作品、专辑曲目、公开歌单搜索和 223 首歌单完整读取。用户登录调试 Chrome 后，已验证账号识别、创建歌单（包含“我喜欢”）及空收藏列表正常返回；非空收藏列表的真实分页、会员音质仍需使用对应账号验证：

1. 在安装该扩展的同一 Chrome profile 登录 [QQ 音乐网页版](https://y.qq.com/)，到“我的歌单”选择 QQ 音乐并刷新。
2. 核对创建与收藏的歌单、账号名称和分页，打开歌单并尝试“一键播放”。
3. 使用自身有权限的歌曲验证播放、音质和歌词；切换账号或退出登录后刷新，确认旧账号收藏不再展示。

非扩展 web 模式受第三方跨域策略限制，与已有音源一致；不要把 web 开发页的 CORS 失败当成扩展登录态失败。
