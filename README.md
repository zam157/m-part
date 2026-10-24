# m-part

多音源音乐播放器，前端使用 Solid 2 + Vite，支持 BiliBili、网易云音乐和 QQ 音乐。项目使用 pnpm workspace，浏览器扩展与 Web 共用一套播放器，一起听服务独立部署。

推荐使用扩展形态：复用浏览器登录态，由浏览器凭据机制和 DNR 规则处理跨域请求。音源接入说明见 [网易云](./docs/netease.md)、[QQ 音乐](./docs/qq.md)。

支持首页推荐、搜索、收藏歌单、完整播放队列、展开播放器、逐字歌词及 Media Session。一起听默认独立取源，房主与管理员同步队列与播放进度，支持房间聊天和操作历史，每个人使用自己的账号和音源权限；另提供网易云 / QQ 音乐 / BiliBili 服务器托管实验，三平台分别保存可选登录凭据，未绑定时匿名取源，服务器内存保管房主提交的会话并转发音频，成员不接收账号凭据。

## 开发与构建

BiliBili 多 P 视频支持选择分 P 播放、多选加入队列与一起听同步，详见 [分 P 播放](./docs/bilibili-parts.md)。

需要支持原生 TypeScript 的 Node.js 22.18+（本次使用 26.12.1 验证）和 `packageManager` 指定的 pnpm 12.14.0。

```bash
pnpm install --frozen-lockfile
pnpm dev:ext           # 扩展开发，终端日志显示 dev server 端口
pnpm build:ext         # 扩展生产构建
pnpm dev:rooms         # 一起听服务，127.0.0.1:3410
pnpm dev:rooms:lan     # 一起听服务，0.0.0.0:3410，供局域网设备访问
pnpm build:rooms       # 独立房间服务产物
pnpm dev               # Web UI，localhost:3333
pnpm build             # Web 客户端及 Nitro 服务
pnpm preview           # 启动构建好的 Web 服务，默认端口 3000
pnpm build:all         # Web、扩展和房间服务
```

加载扩展：Chrome → 扩展程序 → 开发者模式 → 加载已解压的扩展程序，选择：

- 开发构建：`apps/extension/.output/chrome-mv3-dev`
- 生产构建：`apps/extension/.output/chrome-mv3`

开发模式使用独立 Chrome 配置，`apps/extension/web-ext.config.ts` 保留登录态。安装后点击扩展图标打开播放器页。

Web 开发入口保留现有代理接入限制：Vite 开发服务器没有启用 Nitro 代理，`/api/proxy/*` 可能被 HTML fallback 接走。验证音乐取源优先使用扩展；这次 workspace 迁移没有补齐 Web 开发代理。

## 检查

```bash
pnpm typecheck         # 检查全部 workspace
pnpm test --run        # 全部单元测试，包含客户端、房间服务及同步实验
pnpm test:frontend     # player + music
pnpm test:listen       # listen-core + rooms + listen-lab
pnpm test:backend      # Web HTTP 集成测试，需要先 pnpm build && pnpm preview
```

支持单独运行包内检查，例如 `pnpm --filter @m-part/music test`、`pnpm --filter @m-part/rooms typecheck`。根目录只管理 workspace、共享版本和统一命令；各应用和包自行声明依赖。

## 项目结构

```text
apps/
  extension/           WXT 入口、manifest、权限、后台脚本、DNR
  web/                 Web 入口、Nitro 代理、生产服务
  rooms/               独立一起听服务；lab/ 为同步实验与测量工具
packages/
  player/              共用 Solid 播放器、页面、组件和状态
  music/               Provider、音乐类型、请求策略与登录态
  listen-core/         协议、时钟算法、独立的浏览器媒体工具入口
  build-config/        Solid / 路由 / UnoCSS 配置、shadcn 预设及共享静态资源
docs/                  架构、功能与部署说明
locales/               未启用的旧国际化文件，保留
```

目录职责、依赖方向、包的导出方式及独立部署见 [workspace 指南](./docs/workspace.md)。组件和单元测试跟随所属包，跨包调用通过 `@m-part/*` 导出路径和 `workspace:*` 声明，不再使用 `#shared/*`。

## 一起听部署

```bash
pnpm install --frozen-lockfile
pnpm build:rooms
NITRO_HOST=0.0.0.0 NITRO_PORT=3410 node apps/rooms/dist/server/index.mjs
```

将 `apps/rooms/dist/` 整个目录复制到服务器即可运行，不需要同时部署播放器。公网配置 `LISTEN_ALLOWED_ORIGINS`，局域网默认允许不同合法 Chrome 扩展 ID。HTTP / HTTPS 地址均支持；公网建议 HTTPS / WSS。详见 [一起听使用与部署](./docs/listen-together-usage.md)。

客户端与服务需要同时更新至协议 6。托管由房主在界面选择，Cookie 按平台选填，无需服务器开关，远程绑定会话须 HTTPS；真实服务器会话与风控仍待使用者实测，详见使用说明。

实验工具可比较 seek 与倍速微调，通过 `pnpm dev:listen`、`pnpm build:listen` 运行，见 [同步实验](./docs/listen-together-lab.md)。

## 文档

- [Agent 工作指南](./AGENTS.md)、[架构与代码风格](./docs/code-style.md)、[workspace 指南](./docs/workspace.md)
- [Solid 2 约定](./docs/solid-2.md)、[样式约定](./docs/styling.md)、[扩展调试](./docs/extension.md)
- [首页推荐](./docs/recommendations.md)、[收藏歌单](./docs/playlists.md)、[右键菜单](./docs/context-menu.md)
- [播放缓存](./docs/player-cache.md)、[Media Session](./docs/media-session.md)、[展开播放器](./docs/expanded-player.md)
- [一起听设计研究](./docs/listen-together.md)、[实验工具](./docs/listen-together-lab.md)、[使用与部署](./docs/listen-together-usage.md)

## 已知限制

- `pnpm lint` 仍受 TypeScript 7 与 typescript-eslint 兼容问题影响，暂不作为验证命令。
- 扩展图标未配置；关闭播放器页面会停止播放，尚未使用 offscreen 后台播放。
- 一起听房间保存在单个服务进程内存中，重启后清空；多实例共享状态需另行实现。
