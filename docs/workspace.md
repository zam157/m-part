# pnpm workspace 指南

## 应用与包

| Workspace | 目录 | 职责 |
| --- | --- | --- |
| `@m-part/extension` | `apps/extension` | WXT 应用、manifest、后台脚本、DNR 与 Chrome 开发配置 |
| `@m-part/web` | `apps/web` | Web 应用入口、Nitro 代理和生产 HTTP 服务 |
| `@m-part/rooms` | `apps/rooms` | 独立房间服务与可选的同步实验工具 |
| `@m-part/player` | `packages/player` | 共用播放器 UI、文件路由、播放状态、缓存、Media Session 和房间适配 |
| `@m-part/music` | `packages/music` | 音乐类型、Provider、浏览器请求策略和登录态 |
| `@m-part/listen-core` | `packages/listen-core` | 协议验证、单调时钟算法及浏览器媒体准备工具 |
| `@m-part/build-config` | `packages/build-config` | 两种客户端共用的编译插件、UnoCSS、shadcn 及启动静态资源 |

依赖方向：

```text
extension / web ──→ player ──→ music
                         └──→ listen-core ←── rooms（包括 lab）
extension / web / player 的构建与测试 ──→ build-config
web 的代理 ──→ music/proxy-headers（仅常量，不引入浏览器取源模块）
rooms 的托管适配 ──→ music/providers/netease-crypto / qq-crypto / bilibili-wbi（纯签名逻辑）
```

房间服务不依赖 Solid、播放器或浏览器音乐 Provider；可选三平台托管的服务端适配仅复用 music 包的纯加密 / 签名模块。实验工具使用相同服务实现，直接依赖同步工具，不再引用播放器内部文件。`build-config` 中指向播放器目录的路径仅用于路由扫描和包内别名，不引入播放器运行时代码。

## 包的导出与依赖

所有 workspace 均为私有包，暂不发布 npm。内部依赖使用 `workspace:*`，外部版本来自根目录 `pnpm-workspace.yaml` 的 catalog；根目录保留一份锁文件。依赖应声明在实际使用它的包中。

共享包直接导出 TypeScript 源码，由 Vite / Vitest / Nitro 编译，无需单独生成 dist。Node 生产进程只运行应用构建产物，不直接运行共享包源码。

常用导出：

```ts
import '@m-part/player/main'
import { providers } from '@m-part/music/providers'
import type { MusicInfo } from '@m-part/music/types/music-info'
import { clientMessage } from '@m-part/listen-core/protocol'
import { ListenClock } from '@m-part/listen-core/clock'
import { prepareMedia } from '@m-part/listen-core/browser/media'
```

`listen-core/protocol` 和 `clock` 不依赖 DOM、Solid 或浏览器存储；`browser/media` 是显式的浏览器入口。`music/providers/netease-crypto`、`qq-crypto` 和 `bilibili-wbi` 是纯签名模块，不读浏览器登录态，`music/proxy-headers` 不读取 `import.meta.env`，可安全供 Nitro 服务端使用。不要建立会将 Node、浏览器或全部 Provider 混在一起的总入口。

`~/` 仅映射到 `packages/player/src/`，用于播放器内部和其测试；跨包不要使用 `../../packages/...` 或恢复 `#shared/*` 别名。构建配置需定位工作区目录时使用相对于 `import.meta.dirname` 的绝对路径。

## 构建与资源

- 扩展与 Web 的 `main.ts` 都导入 `@m-part/player/main`，保持同一套初始化、播放器状态及 HMR 清理。
- 文件路由扫描 `packages/player/src/pages`，声明生成到 `packages/player/src/file-routes.d.ts`，不要手改。
- `sharedPlugins()` 保留 `solid({ solid: { omitQuotes: false } })`，否则生产样式会丢失。
- Solid、Web、Router 通过共享 catalog 固定版本，客户端配置同时设置 `resolve.dedupe`，防止出现两份响应式运行时。
- UnoCSS 同时扫描 Vite 编译管线和显式的播放器源码 / 应用 HTML 路径，保证包外源码及 WXT 预渲染 HTML 的类名不遗漏。图标集合由构建配置包显式导入，不依赖消费应用的 node_modules。
- 主题启动脚本唯一源码在 `packages/build-config/public/scripts/`，配置加载时复制到客户端应用各自的 public 目录；复制文件被 Git 忽略。
- 字体缓存由构建配置包共享，字体文件输出到各应用自己的 `public/assets/fonts`；首次构建可能需要联网下载。
- DNR 规则只在 `apps/extension/public/rules` 维护，Web 产物不复制扩展权限规则。

产物：

| 命令 | 输出 |
| --- | --- |
| `pnpm build:ext` | `apps/extension/.output/chrome-mv3` |
| `pnpm dev:ext` | `apps/extension/.output/chrome-mv3-dev` |
| `pnpm build` | `apps/web/dist/client`、`apps/web/dist/public`、`apps/web/dist/server` |
| `pnpm build:rooms` | `apps/rooms/dist` |
| `pnpm build:listen` | `apps/rooms/dist-lab-client`、`apps/rooms/dist-lab` |

Web 构建先运行 Vite，再将生成的 HTML 和静态资源交给 Nitro。Web 开发阶段仍是单独的 Vite UI，尚未接入开发代理；不要将迁移误认为这项限制已解决。

## 测试和类型检查

单元测试位于对应 workspace 的 `test/`；房间实验的测试位于 `apps/rooms/lab/test`。根 Vitest 配置汇总 player、music、listen-core、rooms、listen-lab，环境分别使用 jsdom 或 Node。

```bash
pnpm test --run
pnpm test:frontend
pnpm test:listen
pnpm --filter @m-part/music test
pnpm --filter @m-part/rooms test
pnpm typecheck
```

Web HTTP 集成测试需真实服务，独立通过 `pnpm test:backend` 执行，不混入离线单元测试。可用 `WEB_TEST_BASE_URL` 覆盖地址；默认请求 `http://localhost:3000`，先运行 `pnpm build && pnpm preview`。

每个 workspace 的 tsconfig 声明自己的环境与类型。Solid 2 约定仍有效，测试读取信号前调用 `flush()`。ESLint 的 TypeScript 7 兼容限制保持不变。

## 独立部署一起听

在仓库根目录安装依赖并构建服务：

```bash
pnpm install --frozen-lockfile
pnpm --filter @m-part/rooms build
```

复制 `apps/rooms/dist/` 整个目录到目标服务器，在产物目录执行：

```bash
NITRO_HOST=0.0.0.0 NITRO_PORT=3410 node server/index.mjs
```

产物已包含服务依赖，不需要安装或部署浏览器扩展、Web 应用或音乐 Provider。构建命令仍应在完整 workspace 源码中执行，不能只复制 `apps/rooms` 源码后省略 `listen-core`。

服务环境变量、来源限制及局域网步骤见 [一起听使用与部署](./listen-together-usage.md)。monorepo 拆分本身没有改变房间协议和行为；后续托管、管理员、聊天与分 P 功能已将协议升级为 6，需要同时更新客户端与服务。服务直接提供托管能力，无环境变量开关；新房间仍默认独立取源，由房主在界面选择服务器托管；各平台 Cookie 独立选填，未绑定时匿名取源。

## 迁移验证记录（2026-10-23）

- 冻结锁文件安装、全部 workspace 类型检查通过；锁文件比对未引入新的外部依赖版本。
- 322 项单元测试与 1 项 Web HTTP 集成测试通过。
- Web、扩展、独立房间服务、同步实验客户端及服务构建通过。
- 开发与生产扩展实际创建 / 加入同一房间，结束后恢复个人状态；实际 B 站搜索、取源、播放 / 暂停、展开播放器及 Media Session 元数据正常。
- 检查侧栏收放、Tooltip、主题、图标、字体资源和 390px 窄屏；窄屏无横向溢出。
