# 网易云音乐音源

搜索页可选择「网易云」，支持歌曲、歌手、专辑搜索，以及歌手单曲、歌手专辑和专辑曲目。歌曲通过网易云官方返回的音频地址播放，不依赖本地或远程的 Node.js API 服务。

## 请求与加密

- Provider：`shared/utils/providers/netease.ts`，注册在 `shared/utils/providers/index.ts`。
- 加密：`shared/utils/providers/netease-crypto.ts`。WEAPI 使用两次 AES-128-CBC / PKCS#7，第二层使用每次请求新生成的 16 字符密钥；密钥倒序后按协议做无填充 RSA。
- AES 复用项目已有的 `crypto-es`；随机数来自浏览器 `crypto.getRandomValues`，RSA 使用原生 BigInt。运行时代码不使用 Node crypto、Buffer、fs 或第三方 API 服务库。
- 加密表单通过 `tRequest` 发送到 `https://music.163.com/weapi/...`。`tRequest` 的 URLSearchParams 请求体会按表单编码，普通对象仍按 JSON 编码。
- 接口 code 与 HTTP 状态分别检查；请求失败会抛出可展示的错误，不能映射为「没有结果」。

协议与接口参考 [NeteaseCloudMusicApiEnhanced/api-enhanced](https://github.com/NeteaseCloudMusicApiEnhanced/api-enhanced) 的 `util/crypto.js` 和 `module/`，仅适配所需的 WEAPI 行为，没有引入该库。参考代码的 MIT 许可保存在 [licenses/netease-api-enhanced.txt](./licenses/netease-api-enhanced.txt)。

| 能力 | API 路径（请求时将 `/api/` 改为 `/weapi/`） |
| --- | --- |
| 歌曲 / 专辑 / 歌手搜索 | `/api/cloudsearch/pc`，type 分别为 1 / 10 / 100 |
| 首页推荐新歌 | `/api/personalized/newsong`，`type: recommend`、`limit: 20`、`areaId: 0` |
| 当前登录账号 | `/api/w/nuser/account/get` |
| 创建 / 收藏的歌单 | `/api/user/playlist`，使用当前账号 `uid` |
| 歌单曲目 ID | `/api/v6/playlist/detail`，使用完整 `trackIds` 分页 |
| 批量歌曲详情 | `/api/v3/song/detail`，`c` 为本页歌曲 ID 列表 |
| 播放地址 | `/api/song/enhance/player/url` |
| 歌手信息 | `/api/v1/artist/<id>` |
| 歌手单曲 | `/api/v1/artist/songs` |
| 歌手专辑 | `/api/artist/albums/<id>` |
| 专辑曲目 | `/api/v1/album/<id>` |

列表以 20 条分页；搜索、歌手单曲和歌手专辑在服务端分页，专辑曲目接口返回整张专辑后在 Provider 内分页。歌曲毫秒时长转换为秒，封面和音频 URL 统一使用 HTTPS。

## 扩展权限与登录态

`wxt.config.ts` 声明 `music.163.com` 及其子域、`*.music.126.net` 的 HTTPS 权限。`public/rules/netease.json` 为 API 请求设置网易云 Referer / Origin，为音频请求设置 Referer。

登录 cookie 由浏览器 `credentials: 'include'` 携带，不在代码中复制、记录或拼接 Cookie 头。扩展增加 `cookies` 权限，只通过 `chrome.cookies.get` 读取 `music.163.com` 的 `__csrf`，作为 WEAPI 加密参数，不读取或持久化 `MUSIC_U`。这里使用的是现有只读接口，页面提供前往官方站点登录与返回刷新入口；调试时应在实际运行扩展的 Chrome 配置中登录，不能假定 MCP 共享日常浏览器的登录态。

新增或修改 manifest 权限 / DNR 配置后，等待 WXT 重新构建，再用 MCP `reload_extension` 重载开发扩展。仅刷新 app.html 不会重新加载 manifest。

## 播放限制与错误态

- 向官方请求最高 320kbps，展示实际返回的码率；返回试听地址时标注「试听」。当前未提供多音质列表或歌词；歌单浏览与播放见 [收藏歌单](./playlists.md)。
- URL 为空或歌曲状态不可播放时，播放器显示原因和「重试」。会员、登录状态、地域与版权限制仍由网易云决定，不尝试解锁或从其他来源替换音频。
- 音源失败会停止旧音频，避免界面已经切到新歌曲却继续播放上一首。再次选择可播放歌曲或重试成功后清除错误。
- 扩展通过原生 Audio 直接加载官方音频 URL，边缓冲边播放；不先将完整文件下载为 Blob。CDN Referer 由 DNR 的 `media` 规则注入，浏览器管理缓冲和 Range 请求。
- 切换音源会清空旧结果和分页，在途旧请求不能覆盖新音源的结果；详情路由使用结果自身的 provider。

## 验证

按 [扩展调试流程](./extension.md#chrome-devtools-mcp-调试流程)启动并加载开发扩展，选择「网易云」：

1. 搜索歌曲、歌手、专辑并翻页，打开歌手和专辑详情。
2. 搜索 `The truth that you leave`，可用 `Pianoboy高至豪` 的歌曲（ID `139774`）作为官方可播放地址的检查样例；可用性以当前接口响应为准。
3. 点击歌曲后确认 CDN 的 `media` 请求成功、音频 `readyState` 和播放进度正常。可限速检查 `audio.buffered` 尚未覆盖整首时已经开始播放，并测试跳转到未缓冲位置，再暂停。
4. 检查不可播放歌曲的错误提示、重试和切换歌曲后的恢复；不要把「搜索成功」等同于「有播放权限」。

自动检查：`pnpm typecheck`、`pnpm test client --run`、`pnpm build:ext`。加密测试使用 Node/OpenSSL 的独立实现对照浏览器算法；Node 只用于测试，不进入扩展产物。本机 Node 26 若出现 jsdom 的 localStorage 错误，可临时用 `NODE_OPTIONS=--no-experimental-webstorage pnpm test client --run`。
