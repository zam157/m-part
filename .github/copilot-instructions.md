# m-part Copilot 指令

## 项目概览

m-part 开发中的音乐 App, 前端使用 Solid 2 + Vite, 根据 Provider 提供的 API 获取音乐数据并进行播放

## 架构

- **前端**：Solid 2（`solid-js` / `@solidjs/web`）+ Vite，位于 `client/` 目录
  - 基于文件的路由，通过 `client/pages/` 实现（路由表由 `filesystem-routing` 生成）
  - 组件位于 `client/components/`（每个组件一个目录，入口为同名 `.tsx`）
  - 组合式函数与模块级共享状态位于 `client/composables/`
  - 使用 UnoCSS + Tailwind 4 预设（`presetWind4`）进行样式编写
  - **未启用任何自动导入**，所有 API 均需显式从 `solid-js` / `@solidjs/web` 导入

- **后端**：Nitro（无服务器框架），位于 `server/` 目录
  - API 路由位于 `server/api/`
  - 中间件位于 `server/middleware/`

- **状态管理**：不使用状态库，而是把跨路由需要保留的状态提升为 `client/composables/*.ts` 中的**模块级信号**（替代原先 Vue 的 `<KeepAlive>` 语义）；模块级的 `createMemo` / `createEffect` 需要用 `createRoot()` 包裹。
- **路由**：`@solidjs/router` 2 的 `createRouter`，路由表来自 `filesystem-routing` 提供的虚拟模块 `virtual:file-routes`
- **国际化**：本次重构已完全移除 i18n（`locales/` 下的 YAML 仍保留但未接入，界面文案暂为硬编码）
- **测试**：Vitest，分为独立的客户端/服务端测试项目
- **样式**：UnoCSS，搭配 shadcn 预设（neutral 色调）、排版预设、Web 字体（DM Sans、DM Serif Display、Roboto Mono）

## 构建与开发命令

```bash
pnpm dev              # 启动开发服务器，端口 3333
pnpm build            # 生产构建（客户端产物 + Nitro 服务端产物）
pnpm preview          # 本地预览生产构建
pnpm preview-https    # 使用 serve 预览（HTTPS）

pnpm test             # 运行所有测试（vitest）
pnpm test client      # 仅运行客户端测试
pnpm test server      # 仅运行服务端测试
pnpm test -- --ui     # 使用 UI 仪表盘运行测试

pnpm lint             # 运行 ESLint 并自动修复
pnpm typecheck        # 完整类型检查（tsc --build）
pnpm typecheck:frontend  # 仅前端类型检查
pnpm typecheck:backend   # 仅后端类型检查
```

注意：`test/server/api/hello.test.ts` 会真实请求 `http://localhost:3333/api/hello`，需要先启动开发服务器，否则报 `ECONNREFUSED`。

## 核心规范

### ESLint 与代码风格

使用 `@antfu/eslint-config`，并包含以下自定义规则：

- 启用 Solid 支持（`solid: true`，基于 `eslint-plugin-solid`）
- 启用 UnoCSS 校验，但关闭属性排序校验（`unocss/order: 'off'`）
- 忽略自动生成文件 `client/file-routes.d.ts`
- 为多种文件类型启用格式化工具
- 提交前通过 `nano-staged` 自动修复

已知问题：当前 TypeScript 为 7.x，而 `typescript-eslint` 尚未支持该版本，`pnpm lint` 在本仓库会直接报错（与本次框架重构无关，属既有问题）。

### Solid 组件

- 组件函数体**只执行一次**，响应式必须来自信号、`createMemo` 或属性 getter
- **不要解构 props**（会丢失响应性），使用 `props.xxx`，需要转发时用 `splitProps` / `mergeProps`
- 列表渲染使用 `<For>` / `<Index>`，条件渲染使用 `<Show>` / `<Switch>` / `<Match>`，不要用 `.map()`
- 事件名为小驼峰（`onClick`、`onInput`）；HTML/SVG 属性保持连字符（`data-*`、`aria-*`、`fill-rule`）
- 空元素必须自闭合（`<img ... />`、`<input ... />`）
- `classList` 已从 Solid 2 的 JSX 类型中移除，条件类名请用模板字符串拼接
- `aria-*` 等属性只接受 `'true' | 'false'` 字面量
- 副作用与清理使用 `createEffect` 与 `onCleanup`

### Solid 2 响应式语义（重要）

- **信号写入是“暂存”的**：调用 `setX(1)` 后，在同一个同步块内读取 `x()` 仍是旧值，需要 `flush()` 或等待微任务才提交。**不要写入后立即回读同一个信号**，把新值作为参数显式传递
- 因此在 Vitest 中断言信号前需要 `import { flush } from 'solid-js'` 并调用 `flush()`
- 路由默认开启代码分割，路由组件是异步的，开发环境可能出现 `ASYNC_OUTSIDE_LOADING_BOUNDARY` 诊断提示；如需消除，用 `<Loading fallback={...}>` 只包住数据相关的区域

### 样式

- 使用 UnoCSS 工具类（大多数情况下无需 CSS 文件）
- 可通过 `presetWind4` 使用 Tailwind 4 预设
- shadcn 预设搭配 neutral 色调，保证一致的视觉主题
- 在 `uno.config.ts` 中定义自定义快捷方式（例如 `btn`、`empty`、`skeleton`）
- 通过 UnoCSS 图标预设使用 Iconify 图标
- 组件专属样式写在同目录的 `.css` 文件中，用 `@layer components { .xxx { @apply ... } }`
- **不要移除 `vite.config.ts` 中的 `solid({ solid: { omitQuotes: false } })`**：Solid 编译器默认会省略引号，导致 UnoCSS 无法提取工具类，生产构建会丢失全部样式
- `unocss` 版本需保持 ≥ 66.10：66.8.x 在 Vite 8 的多环境构建中会找不到 `vite:css-post`，导致生产产物缺失工具类

### 基于文件的路由

- `client/pages/` 中的页面会自动成为路由：`index.tsx` → `/`，`[id].tsx` → `:id`，`[...all].tsx` → 兜底分支，`(group)` 目录不产生 URL 片段
- 路由实例集中在 `client/router.ts`：`createRouter({ routes: fileRoutes(pageRoutes) })`
- 类型通过自动生成的 `client/file-routes.d.ts` 获得（请勿手改）
- 取参数用 `useParams<T>()` / `useSearchParams()`（查询值类型为 `string | string[] | undefined`，需归一化），跳转用 `useNavigate()`

### 测试配置

Vitest 配置了两个独立的测试项目：

- **server**：Node 环境，用于后端测试（`test/server/**/*.test.ts`）
- **client**：jsdom 环境，用于组件测试（`test/client/**/*.test.ts`）

## TypeScript

使用三个独立的 tsconfig 文件管理不同作用域：

- `tsconfig.frontend.json`：仅客户端代码，`jsx: 'preserve'` + `jsxImportSource: '@solidjs/web'`
- `tsconfig.backend.json`：仅服务端代码
- `tsconfig.node.json`：构建和配置文件

`pnpm typecheck` 使用 `tsc --build` 按项目引用整体检查；针对当前工作范围运行相应的类型检查，以获取准确的诊断信息。

## 依赖管理

使用 pnpm 工作区及目录模式（`pnpm-workspace.yaml`）。依赖版本按作用域（backend、build、dev、frontend）在目录中统一管理，而非在 `package.json` 中直接指定版本。前端目录中的 `solid-js` / `@solidjs/web` / `@solidjs/router` 目前均为预发布版本，使用**精确版本锁定**（不带 `^`）。

## 备注

- 使用 `.editorconfig` 强制执行一致的编辑器设置
- 配置了简单的 git 钩子：pre-commit 时运行 `nano-staged` 进行 ESLint 自动修复
- Nitro 配置为使用 `index.html` 进行静态 HTML 模板渲染；客户端资源实际输出到 `dist/server/public`（而非 `build.outDir` 声明的 `dist/client`）
