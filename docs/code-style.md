# 架构与代码风格

> 这份笔记原先放在 `.github/copilot-instructions.md`（Copilot 专用入口），2026-09 合并到 `docs/`：
> 入口统一为根目录 [AGENTS.md](../AGENTS.md)，细节按主题拆到 `docs/`。下面只写架构与写法，
> 踩坑与硬约定在 AGENTS.md，Solid 2 响应式规则在 [solid-2.md](./solid-2.md)，样式细节在 [styling.md](./styling.md)。

## 项目概览

m-part 是开发中的音乐 App：前端 Solid 2 + Vite，按 Provider 提供的 API 取数并播放；服务端 Nitro；另有浏览器扩展形态。

## 架构

项目使用 pnpm workspace；应用与共享包边界、依赖方向见 [workspace 指南](./workspace.md)。

- `apps/extension`：WXT 扩展入口、manifest、DNR 与浏览器启动配置。
- `apps/web`：Vite Web 入口、Nitro 代理和生产服务产物。
- `apps/rooms`：独立 Nitro 房间服务；`lab/` 保留同步实验工具。
- `packages/player/src`：Solid 2 组件、文件路由、共享状态和样式。
- `packages/music/src`：音乐类型、Provider、请求和登录态。跨包导入使用 `@m-part/music/*`。
- `packages/listen-core/src`：协议与时钟；浏览器媒体工具单独从 `@m-part/listen-core/browser/media` 导入。
- `packages/build-config/src`：共用 Solid / 路由 / UnoCSS 插件和本地 shadcn 预设。

跨路由状态使用 `packages/player/src/composables` 的模块级信号。框架 API 显式导入；未启用自动导入。未启用的国际化文件仍保留在根目录 `locales/`。

## 命令

```bash
pnpm install --frozen-lockfile
pnpm dev:ext          # apps/extension/.output/chrome-mv3-dev
pnpm build:ext        # apps/extension/.output/chrome-mv3
pnpm dev              # Web UI，端口 3333；开发代理限制见 README
pnpm build            # Web 客户端及 Nitro 生产服务
pnpm preview          # 先 build，启动 apps/web/dist/server/index.mjs
pnpm dev:rooms
pnpm dev:rooms:lan
pnpm build:rooms
pnpm test:frontend    # player + music
pnpm test:listen      # listen-core + rooms + listen-lab
pnpm test --run       # 全部离线单元测试
pnpm test:backend     # Web 集成用例；先启动 Web 生产服务
pnpm typecheck        # 各 workspace 的 TypeScript 检查
```

根命令通过 `pnpm --filter` 委托应用或包执行。不要重新把所有依赖和构建配置放回仓库根目录。`pnpm lint` 的 TypeScript 7 兼容限制仍然存在。

## ESLint 与格式化

使用 `@antfu/eslint-config`，并包含以下自定义规则：

- 启用 Solid 支持（`solid: true`，基于 `eslint-plugin-solid`）
- 启用 UnoCSS 校验，但关闭属性排序校验（`unocss/order: 'off'`）
- 忽略自动生成文件 `packages/player/src/file-routes.d.ts`
- 为多种文件类型启用格式化工具
- 提交前通过 `nano-staged` 自动修复

已知问题：本仓库的 TypeScript 为 7.x，而 `typescript-eslint` 尚未支持该版本，`pnpm lint` 会直接报错（与框架重构无关）。

## Solid 组件写法

- 组件函数体**只执行一次**，响应式必须来自信号、`createMemo` 或属性 getter
- **不要解构 props**（会丢失响应性），使用 `props.xxx`，需要转发时用 `splitProps` / `mergeProps`
- 列表渲染用 `<For>` / `<Index>`，条件渲染用 `<Show>` / `<Switch>` / `<Match>`，**不要用 `.map()`**
- 事件名为小驼峰（`onClick`、`onInput`）；HTML / SVG 属性保持连字符（`data-*`、`aria-*`、`fill-rule`）
- 空元素必须自闭合（`<img ... />`、`<input ... />`）
- `classList` 已从 Solid 2 的 JSX 类型中移除：条件类名用 `clsx`，见 [styling.md](./styling.md)
- `aria-*` 等属性只接受 `'true' | 'false'` 字面量
- 副作用与清理用 `createEffect` 与 `onCleanup`
- 响应式语义上的硬性约束（写入暂存、渲染期不能写信号 / 读 store）见 [solid-2.md](./solid-2.md)

## 样式

- 优先 UnoCSS 工具类（大多数情况不需要 CSS 文件）
- `presetWind4` 提供 Tailwind 4 预设；shadcn 预设用 neutral 色调
- 自定义快捷方式（`btn`、`card`、`empty`、`skeleton`、`responsive-cols` …）定义在 `packages/build-config/src/uno.ts`
- 图标用 UnoCSS 的 Iconify 预设
- 组件专属样式写在同目录的 `.css` 文件里，用 `@layer components { .xxx { @apply ... } }`
- **不要移除** `packages/build-config/src/vite.ts` 里的 `solid({ solid: { omitQuotes: false } })`；`unocss` 保持 ≥ 66.10
- 类名合并（含为什么不能用 `cn` 的 twMerge）、快捷方式叠加、搜索页网格见 [styling.md](./styling.md)

## 基于文件的路由

- `packages/player/src/pages/` 中的页面自动成为路由：`index.tsx` → `/`，`[id].tsx` → `:id`，`[...all].tsx` → 兜底分支，`(group)` 目录不产生 URL 片段
- 路由实例集中在 `packages/player/src/router.ts`：`createRouter({ routes: fileRoutes(pageRoutes) })`；扩展形态改用 `hashHistory()`
- 类型来自自动生成的 `packages/player/src/file-routes.d.ts`（勿手改）
- 取参数用 `useParams<T>()` / `useSearchParams()`（查询值类型是 `string | string[] | undefined`，需归一化），跳转用 `useNavigate()`
- ⚠️ 路由参数/查询串都是响应式 store，在组件体里直接取属性会告警且拿到不更新的快照 —— 见 [solid-2.md](./solid-2.md) 第 3 节

## TypeScript

根目录 `tsconfig.base.json` 保存共同选项，每个 workspace 有自己的 `tsconfig.json`，分别声明 DOM、Chrome、Vite 或 Node 类型。根 `tsconfig.json` 供编辑器定位项目；CLI 用 `pnpm typecheck` 递归执行各包检查。

`~/` 仅映射到 `packages/player/src`；跨包用包的 exports，不再使用 `#shared/*`。构建配置包由原生 TypeScript 加载，内部相对导入需写出 `.ts` 扩展名。

## 依赖管理

使用 pnpm 工作区与目录模式（`pnpm-workspace.yaml` 的 catalog）。依赖版本按作用域（backend / build / dev / frontend / shared）在 catalog 里统一管理，**不在 `package.json` 里直接写版本号**（写 `catalog:frontend` 这样的引用）。前端 catalog 里的 `solid-js` / `@solidjs/web` / `@solidjs/router` 是预发布版本，按精确版本锁定（不带 `^`）。

## 备注

- `.editorconfig` 统一编辑器设置；pre-commit 通过 `nano-staged` 跑 ESLint 自动修复
- Nitro 使用 Vite 生成的 `apps/web/dist/client/index.html` 做静态 HTML 模板渲染；客户端资源输出到 `apps/web/dist/public`
