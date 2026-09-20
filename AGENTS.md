# m-part — Agent 工作指南

开发中的音乐播放器：前端 **Solid 2 + Vite**（UnoCSS + shadcn 预设），服务端 Nitro，另有 **浏览器扩展（WXT）** 形态。
运行方式、目录结构、命令见 [README](./README.md)；架构、命令与代码风格见 [docs/code-style.md](./docs/code-style.md)。

> 这个文件和 `docs/` 下的笔记是写给「下一个接手的人或 agent」的：里面全是踩过的坑和不能回退的约定。
> 有些结论只有在这里有 —— 例如为什么类名合并用的是 `cn/lite` 而不是 `cn`。

## 目录导航（改哪里）

| 要改的东西 | 去哪儿 |
| --- | --- |
| 组件 | `client/components/<Name>/<Name>.tsx`（一个目录一个组件，样式放同目录 `.css`） |
| 页面 | `client/pages/`（文件即路由） |
| 跨路由保留的状态 | `client/composables/*.ts` 的**模块级信号** |
| 取数实现（Provider） | `shared/utils/providers/` |
| 请求出口（含扩展策略） | `shared/utils/fetch.ts` |
| 扩展入口 / manifest / DNR 规则 | `entrypoints/`、`wxt.config.ts`、`public/rules/` |
| 构建别名与插件链（两套构建共用） | `vite-shared.ts` |

## 五条硬约定（勿回退）

1. **类名合并只用 `cn/lite` 的 `clsx`**：`clsx('a b', cond && 'c d', props.class)`。不要用 `cn` 的 twMerge —— 它会把 UnoCSS 的数字字号（`text-9` 等）当成文字颜色静默吃掉 → [docs/styling.md](./docs/styling.md)
2. **Solid 2 的响应式规则**：写入暂存、渲染期禁止写信号（会抛错）、渲染期禁止读 store（会静默不更新）、Loading 边界只包内容区 → [docs/solid-2.md](./docs/solid-2.md)
3. **扩展形态的传输层与排查手法** → [docs/extension.md](./docs/extension.md)
4. `vite-shared.ts` 里的 `solid({ solid: { omitQuotes: false } })` 不要删（删了生产环境全部丢样式）；`unocss` 保持 ≥ 66.10
5. 请求统一走 `shared/utils/fetch.ts` + Provider，不要在组件里直连第三方接口

## 组件写法速查（细节见 [docs/code-style.md](./docs/code-style.md)）

- 组件体只执行一次；**不解构 props**（用 `props.xxx`，转发用 `splitProps` / `mergeProps`）
- 列表用 `<For>` / `<Index>`，条件用 `<Show>` / `<Switch>` / `<Match>`，不要 `.map()`
- 事件名小驼峰（`onClick` / `onInput`）；HTML / SVG 属性保持连字符（`data-*` / `aria-*`）
- 空元素必须自闭合；`aria-*` 只接受 `'true' | 'false'` 字面量
- 副作用与清理用 `createEffect` + `onCleanup`

## 命名约定（2026-09 改名后）

- `playlist` / `getPlaylist` = **歌单**（用户收藏的集合）：目前只有 `shared/types/provider.ts` 的占位，尚未实现
- **播放列表 / 播放队列 = `playQueue` 系**：`playQueue` / `setPlayQueue` / `addToPlayQueue` / `removeFromPlayQueue` / `clearPlayQueue` / `randomPlayQueue` / `showPlayQueue` / `setShowPlayQueue`，组件在 `client/components/PlayQueue/`
- 例外：`i-solar-playlist-bold` 是 Iconify 图标 id，不是「歌单」语义，勿改

## 错误态约定

- 组件：`client/components/ErrorMessage/ErrorMessage.tsx`（props `message` / `onRetry?` / `class?`，根节点沿用 `empty` 快捷方式）
- 取文案：`errorMessage(error)`（`shared/utils/index.ts`），把 catch 到的任意值转成字符串
- 渲染顺序统一为 **错误 → loading → 数据 → 空状态**：不要让请求失败冒充「暂无数据」或永久骨架
- 已接入：歌手页（信息 / 单曲 / 专辑）、专辑页（曲目）、搜索页（`client/composables/search.ts` 的 `searchError`）

## 完成前自检

```bash
pnpm typecheck:frontend   # 完整检查用 pnpm typecheck（tsc --build）
pnpm test client          # 46 个用例；断言信号前记得 flush()
```

- 涉及界面时**用浏览器实际看一眼**：扩展形态 `pnpm dev:ext`（+ 加载 `.output/chrome-mv3`）；纯 UI 迭代用 `pnpm dev` + `http://localhost:3333`
- `pnpm lint` 在本仓库不可用（TypeScript 7.x 与 typescript-eslint 不兼容），别拿它当验收
- web 形态（`pnpm dev`）**在开发模式下取不到数据**（`/api/proxy/*` 被 Vite 的 HTML fallback 接走），要看有数据的界面请用扩展形态
