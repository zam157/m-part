# m-part — Agent 工作指南

开发中的音乐播放器：前端 **Solid 2 + Vite**（UnoCSS + shadcn 预设），服务端 Nitro，另有 **浏览器扩展（WXT）** 形态。
运行方式、目录结构、命令见 [README](./README.md)；架构、命令与代码风格见 [docs/code-style.md](./docs/code-style.md)。

> 这个文件和 `docs/` 下的笔记是写给「下一个接手的人或 agent」的：里面全是踩过的坑和不能回退的约定。
> 有些结论只有在这里有 —— 例如为什么类名合并用的是 `cn/lite` 而不是 `cn`。

## 提交与推送约定

- 每次完成修改并通过相应验证后，直接按合理粒度创建 Git 提交，并推送到 `origin` 的当前工作分支，无需事先向用户确认提交或推送。
- 用户已授权将本仓库的修改推送到远程仓库 `https://github.com/zam157/m-part.git`。推送成功后，再告知用户修改内容、验证结果、提交 ID 与远程分支，供用户确认。
- 用户在具体任务中明确要求暂不提交或暂不推送时，以该次要求为准。

## 目录导航（改哪里）

| 要改的东西 | 去哪儿 |
| --- | --- |
| 组件 | `client/components/<Name>/<Name>.tsx`（一个目录一个组件，样式放同目录 `.css`） |
| 页面 | `client/pages/`（文件即路由） |
| 跨路由保留的状态 | `client/composables/*.ts` 的**模块级信号** |
| 一起听 / 播放控制 | `client/composables/player-context.ts`（所有用户操作入口）、`listen-room.ts`、`client/utils/listen-client.ts`；协议与服务见 [一起听说明](./docs/listen-together-usage.md) |
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
- 副作用用 `createEffect(compute, effect)`；effect 执行回调里的清理通过 **`return () => ...`** 注册，不要在那里调用 `onCleanup`（见下方踩坑记录）

## Solid 2 控制流与清理踩坑（勿回退）

- **`STRICT_READ_UNTRACKED`：`<Show>` 的 children 回调不是追踪作用域。** 非 keyed 的回调参数是 accessor，直接写 `{value => value()(...)}` 会触发警告，读取也不会持续更新。像 Popover 这样需要取出渲染函数并调用时，用 `<Show when={props.renderTrigger} keyed>{renderTrigger => renderTrigger(...)}</Show>`：keyed 回调接收原始值，`when` 的值变化时重建子树。需要保留非 keyed 行为时，把 accessor 的读取放进 JSX 绑定等追踪作用域，不要用 `untrack` 掩盖需要更新的读取。参考 `client/components/Popover/Popover.tsx`。
- **`NO_OWNER_CLEANUP`：`createEffect` 的第二个回调是执行副作用的阶段，没有可供 `onCleanup` 注册的 owner。** 事件监听等资源应在这个回调里创建，并返回清理函数；重新执行或组件销毁时会清理。不要回退到 `createEffect(source, value => { ...; onCleanup(...) })`。参考 `client/components/Sidebar/Sidebar.tsx` 与 `client/components/Tooltip/Tooltip.tsx`：

  ```ts
  createEffect(() => target, (element) => {
    element.addEventListener('change', handleChange)
    return () => element.removeEventListener('change', handleChange)
  })
  ```

- 验证时除了类型检查和客户端测试，还要刷新扩展页面，实际触发侧栏收放、跨断点缩放及 Tooltip 显隐，再检查控制台；Tooltip 的清理警告可能只在打开提示后出现。

## 命名约定（2026-09 改名后）

- `playlist` / `getPlaylist` = **歌单**（用户收藏的集合）：`getCurrentUser` 识别账号，`getPlaylists` 列歌单，`getPlaylist` 分页列曲目；一键播放优先用 `getAllPlaylistTracks` 整单能力（网易云每批最多 1000 首），否则分页回退。页面 `/playlists` 与 `/playlist-detail/:provider/:id` → [docs/playlists.md](./docs/playlists.md)
- **播放列表 / 播放队列 = `playQueue` 系**：`playQueue` / `setPlayQueue` / `addToPlayQueue` / `removeFromPlayQueue` / `clearPlayQueue` / `randomPlayQueue` / `showPlayQueue` / `setShowPlayQueue`，组件在 `client/components/PlayQueue/`
- 例外：`i-solar-playlist-bold` 是 Iconify 图标 id，不是「歌单」语义，勿改

## 样式约定

- 尽量用 UnoCSS 的原子类，避免写自定义 CSS；必要时在组件目录下建 `.css` 文件
- 完整长列表可在每个内容项加 `content-visibility-auto`，固定行高或提供内在尺寸占位，让浏览器延迟屏外渲染；节点仍全量创建。播放队列使用此方式，不添加“显示更多”分页 → [docs/styling.md](./docs/styling.md#长列表使用-content-visibility-auto)

## 错误态约定

- 组件：`client/components/ErrorMessage/ErrorMessage.tsx`（props `message` / `onRetry?` / `class?`，根节点沿用 `empty` 快捷方式）
- 取文案：`errorMessage(error)`（`shared/utils/index.ts`），把 catch 到的任意值转成字符串
- 渲染顺序统一为 **错误 → loading → 数据 → 空状态**：不要让请求失败冒充「暂无数据」或永久骨架
- 已接入：歌手页（信息 / 单曲 / 专辑）、专辑页（曲目）、搜索页（`client/composables/search.ts` 的 `searchError`）

## 浏览器调试入口

完整步骤和排障见 [Chrome DevTools MCP 调试流程](./docs/extension.md#chrome-devtools-mcp-调试流程)。

- 用 `pnpm dev:ext` 启动 WXT 扩展开发服务，端口以启动日志为准。
- 等 WXT 构建完成，用 MCP 的 `install_extension` 加载**绝对路径** `.output/chrome-mv3-dev`；生产构建目录才是 `.output/chrome-mv3`。端口以启动日志为准。
- 从工具返回值获取 extension ID、page ID、Service Worker ID 和元素 uid，不要复制文档或上一会话里的 ID。打开 `chrome-extension://<extension-id>/app.html#/` 调试实际扩展页面。
- 除了初次加载，还要操作搜索、播放/暂停、侧栏、Tooltip、主题和跨断点缩放，再查控制台。移动设备模拟可能刷新页面并清空内存状态，操作后重新取快照。
- 音频由模块内 `new Audio()` 创建，不在 DOM 中；`querySelector('audio')` 为空不代表播放器没有运行。用文档里的模块状态检查确认播放进度。

## 完成前自检

```bash
pnpm dev:ext             # 启动扩展开发模式（加载 `.output/chrome-mv3-dev`）
pnpm typecheck:frontend  # 完整检查用 pnpm typecheck（tsc --build）
pnpm test client         # 客户端用例；断言信号前记得 flush()
# pnpm lint              # TypeScript 7.x 与 typescript-eslint 不兼容，暂时不要用
```
