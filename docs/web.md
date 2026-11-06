# Web 取源与部署

运行 `pnpm dev`，打开 [本地设置页](http://localhost:3333/settings)。开发服务器同时提供播放器与 Nitro API。网页会在当前浏览器保存取源方式，切换方式时重新加载页面。

## 代理服务

默认通过网页同站的 Nitro 服务请求 BiliBili、网易云和 QQ 音乐。可按平台在「设置 → 音源账号」选择匿名取源或填写手动 Cookie。手动 Cookie 保存在本浏览器，请求时转交本站服务，由它转发至对应平台的接口。服务不持久化 Cookie。

音频通过同站流式转发，支持浏览器的 Range 请求和进度跳转。代理只允许 Provider 声明的 API 与音频 CDN，跳转仍受同一音源的地址限制。一起听的房间接口及托管音频继续使用用户填写的独立房间服务。

生产运行 `pnpm build && pnpm preview`，默认在 3000 端口启动。也可以在目标服务器以相同相对结构部署 `apps/web/dist/server` 和 `apps/web/dist/public`，然后执行以下命令。对外部署时将 Web 页面和 `/api/provider-*` 路由放在同一个网站源下。由反向代理处理 HTTPS 时，让它设置 `X-Forwarded-Proto` 与 `X-Forwarded-Host` 为实际的公网协议与主机。

```bash
NITRO_HOST=0.0.0.0 NITRO_PORT=3000 node apps/web/dist/server/index.mjs
```

## 浏览器扩展

安装或更新本项目的 Chrome 扩展，在网页「设置 → 网页取源」选择「浏览器扩展」并保存。网页连接固定 ID 的扩展，扩展后台使用同一浏览器配置里的音源网站会话完成搜索、歌单、歌词与取源。登录凭据留在扩展一侧；网页只拿到正常的 Provider 结果和音频。网页已保存的手动 Cookie 在此模式下暂不使用。一起听需要账号托管时，可以在房间内独立填写 Cookie。

默认扩展构建允许 `localhost` 和 `127.0.0.1` 的 HTTP 3333、3000 端口。发布到自己的 HTTPS 网站后，用该网站的准确地址构建扩展并重新加载。多个地址以逗号分隔，端口属于来源的一部分。

```bash
MPART_WEB_ORIGINS=https://music.example.com pnpm build:ext
```

扩展会同时校验 manifest 的网站匹配范围和后台的精确来源列表，且只接受顶层网页发起的连接。列表中的网站可以通过扩展读取音源账号可见的歌曲和歌单资料，应只填写受信任的站点。授权范围和协议入口见 [Chrome 扩展消息文档](https://developer.chrome.com/docs/extensions/develop/concepts/messaging)。

扩展将音频分块交给网页，网页收齐后通过 Blob 播放。单首音频的桥接上限为 128 MiB。长音频需要边缓冲边播放时，使用代理服务。
