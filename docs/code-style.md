# 架构与代码风格

> 这份笔记原先放在 `.github/copilot-instructions.md`（Copilot 专用入口），2026-09 合并到 `docs/`：
> 入口统一为根目录 [AGENTS.md](../AGENTS.md)，细节按主题拆到 `docs/`。下面只写架构与写法，
> 踩坑与硬约定在 AGENTS.md，Solid 2 响应式规则在 [solid-2.md](./solid-2.md)，样式细节在 [styling.md](./styling.md)。

## 项目概览

m-part 是开发中的音乐 App：前端 Solid 2 + Vite，按 Provider 提供的 API 取数并播放；服务端 Nitro；另有浏览器扩展形态。

## 架构

**前端**：Solid 2（`solid-js` / `@solidjs/web`）+ Vite，位于 `client/`

- 基于文件的路由，页面在 `client/pages/`（路由表由 `filesystem-routing` 生成）
- 组件在 `client/components/`，一个目录一个组件，入口为同名 `.tsx`
- 组合式函数与模块级共享状态在 `client/composables/`
- 样式用 UnoCSS + Tailwind 4 预设（`presetWind4`）+ shadcn 预设
- **未启用任何自动导入**，所有 API 显式从 `solid-js` / `@solidjs/web` 导入

**后端**：Nitro（无服务器框架），位于 `server/`

- API 路由在 `server/api/`，中间件在 `server/middleware/`

**状态管理**：不用状态库。跨路由需要保留的状态提升为 `client/composables/*.ts` 里的**模块级信号**（替代原先 Vue 的 `<KeepAlive>` 语义）；模块级的 `createMemo` / `createEffect` 要用 `createRoot()` 包裹。

**路由**：`@solidjs/router` 2 的 `createRouter`，路由表来自 `filesystem-routing` 的虚拟模块 `virtual:file-routes`。

**国际化**：本次重构已完全移除 i18n（`locales/` 下的 YAML 仍保留但未接入，界面文案暂为硬编码）。

**测试**：Vitest，分独立的客户端 / 服务端测试项目。

## 命令

```bash
pnpm dev              # 开发服务器（web 形态），端口 3333
pnpm build            # 生产构建（客户端产物 + Nitro 服务端产物）
pnpm preview          # 无效，见下
pnpm preview-https    # 用 serve 预览（HTTPS）

pnpm dev:ext          # 扩展形态：WXT，起 dev server 并拉起 Chrome，UI 有 HMR
pnpm build:ext        # 扩展形态：产出 .output/chrome-mv3

pnpm test             # 运行所有测试（vitest）
pnpm test client      # 仅客户端测试
pnpm test server      # 仅服务端测试（需先跑 pnpm dev）
pnpm test -- --ui     # 使用 UI 仪表盘

pnpm lint             # 不可用，见 AGENTS.md
pnpm typecheck        # 完整类型检查（tsc --build）
pnpm typecheck:frontend
pnpm typecheck:backend
```

生产构建产出的是 Nitro 服务端产物：客户端资源在 `dist/server/public/assets`，HTML 模板被内联进
`dist/server/server/_chunks/renderer-template.mjs`（没有 index.html 文件）。因此 `pnpm preview`
（`vite preview` 指向 `build.outDir: dist/client`）**无效**，冒烟测试用 `node dist/server/server/index.mjs`（监听 3000）。

## ESLint 与格式化

使用 `@antfu/eslint-config`，并包含以下自定义规则：

- 启用 Solid 支持（`solid: true`，基于 `eslint-plugin-solid`）
- 启用 UnoCSS 校验，但关闭属性排序校验（`unocss/order: 'off'`）
- 忽略自动生成文件 `client/file-routes.d.ts`
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
- 自定义快捷方式（`btn`、`card`、`empty`、`skeleton`、`responsive-cols` …）定义在 `uno.config.ts`
- 图标用 UnoCSS 的 Iconify 预设
- 组件专属样式写在同目录的 `.css` 文件里，用 `@layer components { .xxx { @apply ... } }`
- **不要移除** `vite-shared.ts` 里的 `solid({ solid: { omitQuotes: false } })`；`unocss` 保持 ≥ 66.10
- 类名合并（含为什么不能用 `cn` 的 twMerge）、快捷方式叠加、搜索页网格见 [styling.md](./styling.md)

## 基于文件的路由

- `client/pages/` 中的页面自动成为路由：`index.tsx` → `/`，`[id].tsx` → `:id`，`[...all].tsx` → 兜底分支，`(group)` 目录不产生 URL 片段
- 路由实例集中在 `client/router.ts`：`createRouter({ routes: fileRoutes(pageRoutes) })`；扩展形态改用 `hashHistory()`
- 类型来自自动生成的 `client/file-routes.d.ts`（勿手改）
- 取参数用 `useParams<T>()` / `useSearchParams()`（查询值类型是 `string | string[] | undefined`，需归一化），跳转用 `useNavigate()`
- ⚠️ 路由参数/查询串都是响应式 store，在组件体里直接取属性会告警且拿到不更新的快照 —— 见 [solid-2.md](./solid-2.md) 第 3 节

## TypeScript

三个独立的 tsconfig 管理不同作用域：

- `tsconfig.frontend.json`：仅客户端，`jsx: 'preserve'` + `jsxImportSource: '@solidjs/web'`
- `tsconfig.backend.json`：仅服务端
- `tsconfig.node.json`：构建与配置文件

`pnpm typecheck` 用 `tsc --build` 按项目引用整体检查；只改前端时用 `pnpm typecheck:frontend` 可以更快拿到诊断。

## 依赖管理

使用 pnpm 工作区与目录模式（`pnpm-workspace.yaml` 的 catalog）。依赖版本按作用域（backend / build / dev / frontend / shared）在 catalog 里统一管理，**不在 `package.json` 里直接写版本号**（写 `catalog:frontend` 这样的引用）。前端 catalog 里的 `solid-js` / `@solidjs/web` / `@solidjs/router` 是预发布版本，按精确版本锁定（不带 `^`）。

## 备注

- `.editorconfig` 统一编辑器设置；pre-commit 通过 `nano-staged` 跑 ESLint 自动修复
- Nitro 配置为使用 `index.html` 做静态 HTML 模板渲染；客户端资源实际输出到 `dist/server/public`（而非 `build.outDir` 声明的 `dist/client`）
