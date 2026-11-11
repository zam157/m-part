# m-part — Agent 工作指南

开发中的音乐播放器：pnpm workspace monorepo，前端 **Solid 2 + Vite**（UnoCSS + shadcn 预设），服务端 Nitro，另有 **浏览器扩展（WXT）** 形态。
运行方式、目录结构、命令见 [README](./README.md)；架构、命令与代码风格见 [docs/code-style.md](./docs/code-style.md)。

> 这个文件和 `docs/` 下的笔记是写给「下一个接手的人或 agent」的：里面全是踩过的坑和不能回退的约定。
> 有些结论只有在这里有 —— 例如为什么类名合并用的是 `cn/lite` 而不是 `cn`。

## 提交与推送约定

- 每次完成修改并通过相应验证后，直接按合理粒度创建 Git 提交，并推送到 `origin` 的当前工作分支，无需事先向用户确认提交或推送。
- 用户已授权将本仓库的修改推送到远程仓库 `https://github.com/zam157/m-part.git`。推送成功后，再告知用户修改内容、验证结果、提交 ID 与远程分支，供用户确认。
- 用户在具体任务中明确要求暂不提交或暂不推送时，以该次要求为准。
- 仅在用户明确要求时生成插件 / 服务 ZIP 测试包；常规修改执行所需构建验证即可。

## 询问与等待约定

- 发出澄清、选择或确认询问后，必须始终等待用户明确应答再继续，不启用超时自动继续，也不因等待时间已到而自行采用默认选项或假设答案。
- 用户尚未应答时保持待回答状态；用户补充其他约束或发送其他指令，不等同于回答此前的问题，除非用户明确取消或替代该问题。

## Workspace 边界

- `apps/extension` / `apps/web` 是共享播放器的两个入口；`apps/rooms` 是独立一起听服务。
- `packages/player` 是 UI 与播放状态；`packages/music` 是 Provider 与浏览器取源；`packages/listen-core` 是协议、时钟和显式的浏览器媒体入口；`packages/build-config` 是构建配置及共享静态资源。
- 跨包使用 `@m-part/*` 导出路径和 `workspace:*`，禁止跨包相对导入；`~/` 仅用于播放器内部。
- 各包自己声明依赖，外部版本使用根目录 catalog。不要依靠根目录依赖兜底，也不要在结构调整时顺带升级依赖。
- 共享包直接导出 TypeScript 源码，交由 Vite / Nitro 编译；它们不是可直接由 Node 执行的已编译库。
- 路径、独立部署和全部命令见 [workspace 指南](./docs/workspace.md)。

## 目录导航（改哪里）

| 要改的东西 | 去哪儿 |
| --- | --- |
| 组件 | `packages/player/src/components/<Name>/<Name>.tsx`（一个目录一个组件，样式放同目录 `.css`） |
| 单选下拉 | `components/Select/Select.tsx`；搜索 / 歌单 / Cookie 来源 / 音质 / 同步实验共用，禁止业务页面自行写选择浮层；跨包用 `@m-part/player/select` → [Select 说明](./docs/select.md) |
| 模态弹窗 | `components/Dialog/Dialog.tsx`；歌单 / 分段选择 / 房间取源设置及全屏播放器共用，业务使用 `DialogHeader` / `DialogBody` / `DialogFooter`，禁止重复实现原生开关与通用弹窗样式；跨包用 `@m-part/player/dialog` → [Dialog 说明](./docs/dialog.md) |
| 标签页 | 新组合 API 从 `components/Tabs/index.ts` 导入 `Tabs / TabsList / TabsTrigger / TabsContent`，跨包用 `@m-part/player/tabs`，不支持 RTL。已用于我的歌单类型切换，其他接入位置由用户决定；旧 `Tabs/Tabs.tsx` / `TabContent.tsx` 暂留兼容已有页面，勿混用两套 API → [Tabs 说明](./docs/tabs.md) |
| 页面 | `packages/player/src/pages/`（文件即路由） |
| 跨路由保留的状态 | `packages/player/src/composables/*.ts` 的**模块级信号** |
| 本地歌单 | `composables/local-playlists.ts`、`utils/local-playlist-storage.ts`、`LocalPlaylists/`、`LocalPlaylistDialog/` 与 `/local-playlist/:id`；仅保存曲目资料，IndexedDB 事务成功后再更新状态 → [歌单说明](./docs/playlists.md#本地歌单) |
| 队列身份与插入 | `packages/listen-core/src/queue.ts`（`@m-part/listen-core/queue`）；按音源与 ID 去重，单曲 / 批量 / 下一首 / 房间共用规则；歌单「添加至播放列表」插到当前曲目后并保留播放状态 |
| 歌曲下载 | `composables/download.ts` 与 `utils/music-download.ts`；卡片 / 队列菜单共用，仅使用本机 Provider 取源，不复用房间托管地址或票据，不改变播放 → [下载说明](./docs/downloads.md) |
| 一起听 / 播放控制 | `packages/player/src/composables/player-context.ts`（所有用户操作入口）、`listen-room.ts`、`packages/player/src/utils/listen-client.ts`；协议与服务见 [一起听说明](./docs/listen-together-usage.md) |
| 一起听聊天 / 操作历史 | `packages/player/src/components/ListenRoomHistory/`；服务端 `listen-rooms.ts` 记录与截断，聊天 / 授权不修改播放版本 |
| 托管一起听 / 媒体票据 | `apps/rooms/server/utils/hosted-media.ts`、`apps/rooms/server/providers/`、`room-control` / `room-audio` 路由；客户端 `ListenRoomSources/` 与 `utils/room-http.ts` |
| 取数实现（Provider） | `packages/music/src/utils/providers/` |
| 图片缩放 | Provider `getImageUrl`、`@m-part/music/image`、`ProviderImage/`；按用途生成缩略图与 1x / 2x 候选，存储与协议中的 `coverUrl` 保留源地址 → [图片说明](./docs/images.md) |
| 请求出口（含扩展策略） | `packages/music/src/utils/fetch.ts`；Web 默认同站 Nitro 代理，也可通过扩展桥接，详见 [Web 取源与部署](./docs/web.md) |
| m-part 账号与房间预设 | `apps/web/server/account/`、`apps/web/drizzle/`、`AccountSettings/`、`RoomProfiles/`；预设按用户与版本更新 → [账号服务](./docs/account.md) |
| 设置页 | `packages/player/src/pages/settings.tsx`；集中放置外观、网页取源及音源账号，扩展应用页隐藏网页取源 |
| 客户端 Cookie 设置 | `ProviderDefinition.cookie` 可选声明（`providers/*-definition.ts`）；设置页、存储、DNR 与 Web 转发共用 `@m-part/music/provider-definitions`，禁止通用层按平台写分支。轻量声明不能导入完整 Provider / fetch → [客户端 Cookie](./docs/client-cookies.md) |
| 扩展入口 / manifest / DNR 规则 | `apps/extension/entrypoints/`、`apps/extension/wxt.config.ts`、`apps/extension/public/rules/` |
| 构建别名与插件链（两套构建共用） | `packages/build-config/src/vite.ts` |

## 多音源功能设计原则

- 涉及多音源的客户端功能，优先复用或扩展 **Provider 的通用能力与声明**，由各音源提供实现或配置，客户端根据能力统一渲染和调用。
- 不要在页面、组件或共享业务逻辑中逐个判断音源名称，硬编码对应的文案、接口、参数或行为。平台专有规则封装在各自 Provider 内；可描述为数据的差异由 Provider 元数据提供。
- 能力允许按需实现；客户端按能力是否存在决定入口、行为及合理回退，不要求所有音源提供相同功能。即使当前仅一个音源支持，也先判断它是否属于可供其他音源复用的能力。
- 抽象以实际需求为准，不为假想差异过度设计。新增音源应主要通过注册声明和实现能力接入，避免反复修改通用客户端中的平台分支。设计步骤与已有示例见 [Provider 能力设计](./docs/code-style.md#provider-能力设计)。

## 五条硬约定（勿回退）

1. **类名合并只用 `cn/lite` 的 `clsx`**：`clsx('a b', cond && 'c d', props.class)`。不要用 `cn` 的 twMerge —— 它会把 UnoCSS 的数字字号（`text-9` 等）当成文字颜色静默吃掉 → [docs/styling.md](./docs/styling.md)
2. **Solid 2 的响应式规则**：写入暂存、渲染期禁止写信号（会抛错）、渲染期禁止读 store（会静默不更新）、Loading 边界只包内容区 → [docs/solid-2.md](./docs/solid-2.md)
3. **扩展形态的传输层与排查手法** → [docs/extension.md](./docs/extension.md)
4. `packages/build-config/src/vite.ts` 里的 `solid({ solid: { omitQuotes: false } })` 不要删（删了生产环境全部丢样式）；`unocss` 保持 ≥ 66.10
5. 请求统一走 `packages/music/src/utils/fetch.ts` + Provider，不要在组件里直连第三方接口

- `MusicInfo.title` 是纯文本：BiliBili 搜索高亮标签在 Provider 映射时清除并解码实体；展示标题使用 JSX 文本，不使用 `innerHTML`，避免标题中的尖括号被再次解析。
- 客户端手动 Cookie 仅在独立的 `mpart-client-cookie:<provider>` 本机设置中保存，来源模式独立存于 `mpart-client-cookie-mode:<provider>`；切换模式保留值，清除值保留模式，手动模式无值时提示填写而不回退网站账号。禁止混入队列、歌单、房间协议或日志。手动会话和网站会话不能混用认证字段；扩展通过受限会话规则替换 API Cookie，不回写网站 Cookie。一起听仅房主按下方托管约定同步当前会话。

## 组件写法速查（细节见 [docs/code-style.md](./docs/code-style.md)）

- 组件体只执行一次；**不解构 props**（用 `props.xxx`，转发用 `splitProps` / `mergeProps`）
- 列表用 `<For>` / `<Index>`，条件用 `<Show>` / `<Switch>` / `<Match>`，不要 `.map()`
- 事件名小驼峰（`onClick` / `onInput`）；HTML / SVG 属性保持连字符（`data-*` / `aria-*`）
- 空元素必须自闭合；`aria-*` 只接受 `'true' | 'false'` 字面量
- 副作用用 `createEffect(compute, effect)`；effect 执行回调里的清理通过 **`return () => ...`** 注册，不要在那里调用 `onCleanup`（见下方踩坑记录）

## Solid 2 控制流与清理踩坑（勿回退）

- **`STRICT_READ_UNTRACKED`：`<Show>` 的 children 回调不是追踪作用域。** 非 keyed 的回调参数是 accessor，直接写 `{value => value()(...)}` 会触发警告，读取也不会持续更新。像 Popover 这样需要取出渲染函数并调用时，用 `<Show when={props.renderTrigger} keyed>{renderTrigger => renderTrigger(...)}</Show>`：keyed 回调接收原始值，`when` 的值变化时重建子树。需要保留非 keyed 行为时，把 accessor 的读取放进 JSX 绑定等追踪作用域，不要用 `untrack` 掩盖需要更新的读取。参考 `packages/player/src/components/Popover/Popover.tsx`。
- **`NO_OWNER_CLEANUP`：`createEffect` 的第二个回调是执行副作用的阶段，没有可供 `onCleanup` 注册的 owner。** 事件监听等资源应在这个回调里创建，并返回清理函数；重新执行或组件销毁时会清理。不要回退到 `createEffect(source, value => { ...; onCleanup(...) })`。参考 `packages/player/src/components/Sidebar/Sidebar.tsx` 与 `packages/player/src/components/Tooltip/Tooltip.tsx`：

  ```ts
  createEffect(() => target, (element) => {
    element.addEventListener('change', handleChange)
    return () => element.removeEventListener('change', handleChange)
  })
  ```

- 验证时除了类型检查和客户端测试，还要刷新扩展页面，实际触发侧栏收放、跨断点缩放及 Tooltip 显隐，再检查控制台；Tooltip 的清理警告可能只在打开提示后出现。

## Web 取源约定

- Web 通过同站 Nitro 代理或扩展的只读 Provider 桥接取源。代理的 API 和音频目标由轻量 Provider 声明校验，音频保持 Range 流式响应；拒绝跨平台重定向，不转发浏览器请求自带的 Cookie 或上游 Set-Cookie。房间 API 及托管音频仍直连房间服务器。
- 扩展桥接要求 `MPART_WEB_ORIGINS` 的精确来源（含端口），只允许主页面调用只读操作，不提供任意网址转发或 Cookie 导出。网站会话留在扩展后台。网页手动 Cookie 只随所选平台的只读操作交给后台，按平台串行应用。后台会话规则使用原平台规则 ID + 1000，仅匹配扩展发起的无标签页 API 请求，结束时清理；扩展标签页规则继续排除后台请求。

## 一起听托管约定

- 房间服务默认不校验 Origin，仅在设置 `LISTEN_ALLOWED_ORIGINS` 时按精确允许列表校验；显式空值表示拒绝所有来源，不根据本机 / 局域网 / 公网地址自动切换策略。原生 Audio 可不带 Origin，仍必须持有效媒体票据。见 [使用与部署](./docs/listen-together-usage.md)。
- 当前协议版本 8，客户端、服务和实验工具同时更新。新音乐房间各平台默认服务器取源，跟随房主音源设置当前选择的手动 / 网站会话；无网站登录态时匿名托管，Web 无法读取第三方网站会话时同样匿名。房主仍可逐平台切换各自取源。房间内单独绑定 Cookie 后该平台使用专用会话，忽略全局设置变化，直到主动选择「使用音源设置 Cookie」；撤销仅清除该平台会话并保留取源方式。覆盖标记可随房主恢复身份保存，Cookie 本身仅留在服务内存。仅影响当前播放平台的来源或有效凭据变更使媒体版本和播放 revision 失效；其他平台仅更新状态与 activityVersion，不能中断当前音频。
- 配对的一起听服务用短期签名验证 Web 账号。登录创建的长期房间保存在 SQLite，账号管理员授权关联账号 ID；房主退出或离线宽限结束后暂停，手动结束才删除。仅持久化房间、公开曲目和取源方式，不写入账号会话、房间恢复凭据、托管 Cookie、媒体票据或聊天历史。部署见 [长期房间](./docs/listen-together-usage.md#长期房间)。
- 房主独占管理员授权、结束房间与托管凭据管理；管理员可控制播放和队列。自动切歌、媒体就绪时长与全员缓冲仍以房主为准。角色与聊天使用独立 `activityVersion`，不推进播放 `revision`；历史仅在房间内存保留最近 200 条，禁止混入凭据、上游地址或媒体票据。
- 用户已授权托管跟随当前音源会话：仅在房主创建 / 恢复房间及托管会话变化时读取并通过鉴权 HTTP 同步，创建入口说明提交行为；成员不得读取或上传个人凭据。导出字段与必需字段组由 `ProviderDefinition.cookie.session` 声明，手动会话不补读网站字段，网站模式不导出停用的手动值。HTTP / HTTPS 房间地址均可填写与绑定，不按 TLS / 回环地址限制。服务器只在内存保留受控会话；公开协议、队列、个人缓存与日志不得加入 Cookie、上游 URL 或媒体票据。真实账号验收仍须用户自行在页面输入，不在聊天或日志索要凭据。
- 网站会话读取地址由 `cookie.session.urls` 声明，Cookie 所属域由 `session.domains` 声明；扩展权限生成与读取前检查共用 `websiteCookiePermissions`，覆盖查询主机、父域及 HTTP / HTTPS（Chrome 按 Cookie 自身域和 Secure 标记过滤，不能只检查查询 URL）。每个候选 URL 独立取一套完整会话，不跨 URL 拼账号字段。网站 Cookie 可用时直接用于托管，读取失败、权限不足或登录字段不完整必须报错，不能静默视为匿名；确认无登录字段时才匿名取源。
- 音频走原生 Audio + 短期成员票据，Web 形态也不能先整首转 Blob。成员断线只取消本人的流，全局源失败才暂停房间；凭据 / 来源 / 播放实例变化必须中止旧请求，禁止悄悄改用个人账号。
- 一起听错误日志统一走 `apps/rooms/server/utils/diagnostics.ts`，仅输出受控文案、固定接口、平台、HTTP / 业务码及网络错误链。禁止直接打印 Error、请求 / 响应对象、Cookie、成员令牌、票据或上游签名地址；切歌、退出引起的预期取消不记为故障。
- `listen-core/clock` 的 `DriftCorrection` 仅供 lab 比较。正式播放器继续使用 300ms / 2 秒 seek 策略，未量化双设备和听感前不要直接替换。
- 本机已验证用户显式绑定的网易云账号取源、Bili 匿名播放，以及 Bili 网站 Cookie 自动绑定、单端账号托管播放与刷新恢复；QQ 真实登录账号、公网账号托管双设备同步及目标部署长期风控尚未验收，模拟上游与合成音频通过不能写成真实平台已验收。详见 [使用说明](./docs/listen-together-usage.md)。

## 命名约定（2026-09 改名后）

- 分段选择按 Provider 的 `getTrackParts` 能力启用，`isTrackPart` 判断已解析曲目、`trackPartsLabel` 提供文案；选择器与播放入口不得判断具体音源或解析其 ID。接入方式见 [通用分段选择](./docs/track-parts.md)。
- BiliBili 单 P 曲目 ID 使用 `BV号:CID`；裸 BV 兼容旧条目的 P1。不要用 P 序号做持久身份，也不要把视频总时长当作单 P 时长。专有身份、批量房间操作及接口约定见 [分 P 播放](./docs/bilibili-parts.md)。

- `playlist` / `getPlaylist` = **歌单**（用户收藏的集合）：`getCurrentUser` 识别账号，`getPlaylists` 列歌单，`getPlaylist` 分页列曲目；一键播放优先用 `getAllPlaylistTracks` 整单能力（网易云每批最多 1000 首），否则分页回退。页面 `/playlists` 与 `/playlist-detail/:provider/:id` → [docs/playlists.md](./docs/playlists.md)
- **播放列表 / 播放队列 = `playQueue` 系**：`playQueue` / `setPlayQueue` / `addToPlayQueue` / `removeFromPlayQueue` / `clearPlayQueue` / `randomPlayQueue` / `showPlayQueue` / `setShowPlayQueue`，组件在 `packages/player/src/components/PlayQueue/`
- 例外：`i-solar-playlist-bold` 是 Iconify 图标 id，不是「歌单」语义，勿改

## 样式约定

- 尽量用 UnoCSS 的原子类，避免写自定义 CSS；必要时在组件目录下建 `.css` 文件
- 间距优先用 `gap` 和 `padding`：兄弟元素之间由父容器的 `gap` 控制，容器内部留白用 `padding`。避免新增用于撑开间隔的 `margin`（含 `m-*` / `mt-*` / `space-*` 等），也尽量避免负 margin 补偿布局；确有布局需要时再使用。
- 居中优先用父容器的 flex / grid 对齐，避免 `m-auto` / `mx-auto` 等依赖自动 margin 的居中方式。dialog 使用 `fixed` + `top-1/2 left-1/2` + `-translate-x-1/2 -translate-y-1/2` 居中，并重置原生 inset / margin；不要用 `m-auto` 实现 dialog 居中。
- 完整长列表可在每个内容项加 `content-visibility-auto`，固定行高或提供内在尺寸占位，让浏览器延迟屏外渲染；节点仍全量创建。播放队列使用此方式，不添加“显示更多”分页 → [docs/styling.md](./docs/styling.md#长列表使用-content-visibility-auto)

## 错误态约定

- 组件：`packages/player/src/components/ErrorMessage/ErrorMessage.tsx`（props `message` / `onRetry?` / `class?`，根节点沿用 `empty` 快捷方式）
- 取文案：`errorMessage(error)`（`packages/player/src/utils/index.ts`），把 catch 到的任意值转成字符串
- 渲染顺序统一为 **错误 → loading → 数据 → 空状态**：不要让请求失败冒充「暂无数据」或永久骨架
- 已接入：歌手页（信息 / 单曲 / 专辑）、专辑页（曲目）、搜索页（`packages/player/src/composables/search.ts` 的 `searchError`）

## 浏览器调试入口

完整步骤和排障见 [Chrome DevTools MCP 调试流程](./docs/extension.md#chrome-devtools-mcp-调试流程)。

- 扩展公钥固定在 `apps/extension/wxt.config.ts` 的 `manifest.key`，ID 为 `cjkjimmicmbpjjbopadpdfgpgmgobddl`；不要每次构建生成密钥或依赖本地 `.keys/` 目录读取公钥。私钥只在本机被忽略的 `.keys/` 中，用于 CRX 签名。开发 / 生产共用 ID，双客户端验收使用不同浏览器配置文件或设备。
- 用 `pnpm dev:ext` 启动 WXT 扩展开发服务，端口以启动日志为准。
- 等 WXT 构建完成，用 MCP 的 `install_extension` 加载**绝对路径** `apps/extension/.output/chrome-mv3-dev`；生产构建目录才是 `apps/extension/.output/chrome-mv3`。端口以启动日志为准。
- 从工具返回值获取 extension ID、page ID、Service Worker ID 和元素 uid，不要复制文档或上一会话里的 ID。打开 `chrome-extension://<extension-id>/app.html#/` 调试实际扩展页面。
- 除了初次加载，还要操作搜索、播放/暂停、侧栏、Tooltip、主题和跨断点缩放，再查控制台。移动设备模拟可能刷新页面并清空内存状态，操作后重新取快照。
- 音频由模块内 `new Audio()` 创建，不在 DOM 中；`querySelector('audio')` 为空不代表播放器没有运行。用文档里的模块状态检查确认播放进度。

## 完成前自检

- 按本次提交的实际改动选择验证方式，不机械执行下方所有命令。未涉及代码逻辑修改时，无需运行 Vitest 测试；简单样式调整、按钮文案、文档修改等未涉及类型结构变化的简单改动，也无需运行类型检查。按需核对差异或页面效果即可；涉及代码逻辑、类型或接口变化时，再执行与改动相关的测试和类型检查。

```bash
pnpm dev:ext             # 启动扩展开发模式（加载 `apps/extension/.output/chrome-mv3-dev`）
pnpm typecheck:frontend  # 完整检查用 pnpm typecheck
pnpm test:frontend         # 客户端用例；断言信号前记得 flush()
# pnpm lint              # TypeScript 7.x 与 typescript-eslint 不兼容，暂时不要用
```
