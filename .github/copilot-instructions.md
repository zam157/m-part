# m-part Copilot 指令

## 项目概览

m-part 开发中的音乐 App, 前端使用 Vue 3 + Vite, 根据 Provider 提供的 API 获取音乐数据并进行播放

## 架构

- **前端**：Vue 3 + Vite，位于 `client/` 目录
  - 基于文件的路由，通过 `client/pages/` 实现
  - 组件位于 `client/components/`
  - 组合式函数（Composables）位于 `client/composables/`
  - 使用 UnoCSS + Tailwind 预设进行样式编写
  - 已启用 Vue、vue-i18n、@vueuse/core 和 vue-router 的自动导入

- **后端**：Nitro（无服务器框架），位于 `server/` 目录
  - API 路由位于 `server/api/`
  - 中间件位于 `server/middleware/`

- **状态管理**：不使用 Pinia，而是依赖 Vue 内置的响应式系统和组合式函数进行状态管理。
- **路由**：Vue Router 5，支持自动导入
- **国际化**：Vue I18n，YAML 语言文件位于 `locales/`
- **测试**：Vitest，分为独立的客户端/服务端测试项目
- **样式**：UnoCSS，搭配 shadcn 预设（neutral 色调）、排版预设、Web 字体（DM Sans、DM Serif Display、Roboto Mono）

## 构建与开发命令

```bash
pnpm dev              # 启动开发服务器，端口 3333
pnpm build            # 生产构建（使用 vite-ssg 进行静态站点生成）
pnpm preview          # 本地预览生产构建
pnpm preview-https    # 使用 serve 预览（HTTPS）

pnpm test             # 运行所有测试（vitest）
pnpm test client      # 仅运行客户端测试
pnpm test server      # 仅运行服务端测试
pnpm test -- --ui     # 使用 UI 仪表盘运行测试

pnpm lint             # 运行 ESLint 并自动修复
pnpm typecheck        # 完整类型检查（前端 + 后端 + Node）
pnpm typecheck:frontend  # 仅前端类型检查
pnpm typecheck:backend   # 仅后端类型检查
```

## 核心规范

### ESLint 与代码风格

使用 `@antfu/eslint-config`，并包含以下自定义规则：

- Vue 属性和事件使用**无连字符风格**（例如 `@click` 而非 `@click`，`myProp` 而非 `my-prop`）
- 启用 UnoCSS 校验
- 为多种文件类型启用格式化工具
- 提交前通过 `nano-staged` 自动修复

### Vue 组件

- 组件自动导入已禁用，请手动导入组件以获得更清晰的控制。
- 使用 `<script setup>` 搭配 TypeScript
- `client/composables/` 中的组合式函数会自动导入（需配置）
- 通过自动导入可直接访问 Vue、vue-i18n、@vueuse/core 和 vue-router

### 样式

- 使用 UnoCSS 工具类（大多数情况下无需 CSS 文件）
- 可通过 `presetWind4` 使用 Tailwind 4 预设
- shadcn 预设搭配 neutral 色调，保证一致的视觉主题
- 在 `uno.config.ts` 中定义自定义快捷方式（例如 `btn` 类）
- 通过 UnoCSS 图标预设使用 Iconify 图标

### 国际化 (i18n)

- 翻译文件以 YAML 格式存放在 `locales/` 目录
- 文件名即为语言代码（例如 `en.yaml` → `en` 语言）
- 自动加载，无需手动注册
- 使用 `useI18n()` 组合式函数获取翻译内容

### 基于文件的路由

- `client/pages/` 中的页面会自动成为路由
- 使用 `[...all].vue` 作为兜底路由
- 通过 `typed-router.d.ts`（自动生成）获得类型化的路由对象

### 测试配置

Vitest 配置了两个独立的测试项目：

- **server**：Node 环境，用于后端测试（`test/server/**/*.test.ts`）
- **client**：jsdom 环境，用于组件测试（`test/client/**/*.test.ts`）

## TypeScript

使用三个独立的 tsconfig 文件管理不同作用域：

- `tsconfig.frontend.json`：仅客户端代码
- `tsconfig.backend.json`：仅服务端代码
- `tsconfig.node.json`：构建和配置文件

针对当前工作范围运行相应的类型检查，以获取准确的诊断信息。

## 依赖管理

使用 pnpm 工作区及目录模式（`pnpm-workspace.yaml`）。依赖版本按作用域（backend、build、dev、frontend）在目录中统一管理，而非在 `package.json` 中直接指定版本。

## 备注

- 使用 `.editorconfig` 强制执行一致的编辑器设置
- 配置了简单的 git 钩子：pre-commit 时运行 `nano-staged` 进行 ESLint 自动修复
- Nitro 配置为使用 `index.html` 进行静态 HTML 模板渲染
