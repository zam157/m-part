# 浏览器扩展形态（WXT）

## 为什么有这一层

纯 web 页面直连 `api.bilibili.com` 会被 CORS 拦掉，也读不到用户的登录 cookie。扩展页面在 manifest 里声明 `host_permissions` 后不受 CORS 限制，cookie 由 `credentials: 'include'` 自动携带 —— 这是当前的主线形态；`server/` 那套 Nitro 代理是 web 形态的退路。

## 配置要点

`wxt.config.ts`：

- `srcDir: '.'`、`entrypointsDir: 'entrypoints'`、`publicDir: 'public'`、`imports: false`（仓库约定不用自动导入）
- manifest 由配置生成，没有手写的 `manifest.json`；`host_permissions` 与 `declarative_net_request.rule_resources` 都在这里
- `define` 注入 `VITE_TARGET=extension` → `shared/utils/constants.ts` 的 `TARGET_EXTENSION`。验证 define 是否生效：产物 JS 里搜不到 `VITE_TARGET` 字样
- **不要继承 `.wxt/tsconfig.json`**：它把 `~` 映射到 srcDir，和仓库既有的 `~/` → `client/` 冲突。别名统一由 `vite-shared.ts` 提供，两套构建共用
- WXT 关掉了 Vite 自身的配置加载（`configFile = false`），所以根目录的 `vite.config.ts`（web / Nitro 形态）不会被卷进扩展构建
- **不要用 `@wxt-dev/module-solid`**：它只做 `vite-plugin-solid(vite)` + `build.target: 'esnext'` + `solid-js` 自动导入，会丢掉 `omitQuotes: false`（静默丢样式），还与 `imports: false` 冲突
- 改动 `wxt.config.ts` 会让 WXT 做 full-restart（重起 dev server + 浏览器）

`web-ext.config.ts` 开了 `keepProfileChanges`：WXT 默认用一次性 Chrome 配置启动，没有日常登录态；要在 dev 窗口里验证 cookie，得在那个窗口登录一次。

## 入口

- `entrypoints/app/index.html` → 产物 `/app.html`，由 `client/main.tsx` 驱动
- ⚠️ HTML 里的 script `src` 必须是**相对路径**（`../../client/main.tsx`）。WXT 的 dev 预渲染插件用 `resolve(dirname(html), src)` 解析，以 `/` 开头会被当成绝对路径（Windows → `D:\client\main.tsx`），dev 下改写成 `@fs/D:/client/main.tsx` 而 404；**build 模式走 Vite 的 root 解析所以正常** —— 这个坑只在 dev 暴露，表现是「TSX 没被解析」
- `entrypoints/background.ts`：`defineBackground(() => { ... })`，**运行时逻辑必须写在回调里**，WXT 会在构建期用 Node 加载这个文件

## 传输层

`shared/utils/fetch.ts` 的 `applyExtensionPolicy`（`TARGET_EXTENSION` 时生效）：

- 默认 `credentials: 'include'`：登录态靠它自动携带
- 剥掉 fetch 规范禁止 / 浏览器自管的请求头：`cookie`、`referer`、`origin`、`user-agent`、`accept-encoding`、`connection`、`content-length`、`host`
- `referer` / `origin` 由 `public/rules/bilibili.json` 的 DNR `modifyHeaders` 注入：`api.bilibili.com` → `www`；`x/space/*`、`x/polymer/*`、`x/series/*` → `space.bilibili.com`；`bilivideo.*` → 播放用 referer

⚠️ `host_permissions` 里少写域名**不会**报权限错误，而是那个请求不再豁免 CORS；此时带着 `credentials: 'include'` 会撞上 CDN 的 `Access-Control-Allow-Origin: *`：

```
... has been blocked by CORS policy: The value of the 'Access-Control-Allow-Origin' header
in the response must not be the wildcard '*' when the request's credentials mode is 'include'
```

极易误判成「CDN 不支持跨域」。bilibili 音频 CDN 有 `.com`（upos 镜像）与 `.cn`（`mcdn.bilivideo.cn:8082`）两套，域名要改两处：`wxt.config.ts` 的 `host_permissions` + `public/rules/bilibili.json`（DNR 规则已用 `requestDomains: ['bilivideo.com','bilivideo.cn']`，自动覆盖子域）。

## MV3 / 扩展环境的坑

- 扩展页 CSP 是 `script-src 'self'`，**禁内联脚本** → 深色模式引导移到 `public/scripts/color-mode-bootstrap.js`
- `chrome-extension://` 下 history 路由刷新会 404 → 扩展形态用 `hashHistory()`（`client/router.ts`），URL 形如 `app.html#/search`
- Chrome 保留文件名：**扩展根目录**下 `_` 前缀文件会被拒绝安装（`Cannot load extension with file or directory name _headers`）。WXT 会把 `public/` 整体拷进根目录，所以 `public/` 里不能放 `_headers`（已删除；将来要做静态托管可从 git 恢复）。**子目录里的 `_` 前缀是允许的**（WXT 的 `chunks/_...all_*.js`、Vite 的 `_plugin-vue_export-helper-*.js` 都能正常加载）
- 扩展页是安全上下文 → 接口返回的 `http://` 封面会被混合内容策略拦掉，已在 provider 映射处用 `shared/utils/url.ts` 的 `toHttpsUrl` 统一升级。注意它必须同时处理**协议相对地址**（`//i2.hdslb.com/...`）：在 `chrome-extension://` 页面里会被解析成 `chrome-extension://i2.hdslb.com/...`，比混合内容更隐蔽

## 如何验证

**无头（不必拉起浏览器）**：临时在 `web-ext.config.ts` 加 `disabled: true`，跑 `pnpm dev:ext`，然后请求

- `http://localhost:<启动日志中的端口>/app.html` —— 看 script src 是否被改写成 dev server URL
- `http://localhost:<启动日志中的端口>/client/main.tsx` —— 看是否已编译成 `_$createComponent`

验完记得去掉 `disabled`。这只能检查开发资源，涉及 host permissions、DNR 和播放的行为需要在实际扩展页验证。

## Chrome DevTools MCP 调试流程

### 1. 配置 MCP

扩展调试需要启用 MCP 默认关闭的扩展工具。在项目根目录执行以下命令；已配置时先保留其他仍需要的参数：

```bash
codex mcp add chrome-devtools -- npx -y chrome-devtools-mcp@latest \
  --categoryExtensions \
  --experimentalIncludeAllPages \
  --experimentalDevtools \
  --headless=false \
  --workspace="$PWD"
```

| 参数 | 用途 |
| --- | --- |
| `--categoryExtensions` | 提供安装、列举、重载、触发动作、卸载扩展的工具 |
| `--experimentalIncludeAllPages` | 将后台页等页面类型纳入页面列表 |
| `--experimentalDevtools` | 允许操作 DevTools 页面；可能自动打开 DevTools，影响当前选中的标签 |
| `--headless=false` | 使用有界面 Chrome，方便人工与 agent 交替查看 |
| `--workspace=<项目绝对路径>` | 允许 MCP 读取项目内的扩展产物和保存调试文件 |

该命令更新用户级 MCP 配置，`$PWD` 会在执行时展开为本机路径；换 checkout 时要检查目录是否仍适用。未协商 MCP roots 且未指定 workspace 时，文件访问默认限于系统临时目录，会影响从项目目录安装扩展。参数以本机 `--help` 和[官方配置说明](https://github.com/ChromeDevTools/chrome-devtools-mcp/blob/main/docs/configuration.md)为准。修改配置后重启 Codex，确认本会话出现 `install_extension` 等工具。

### 2. 启动 WXT 并加载开发扩展

```bash
pnpm dev:ext
```

等终端显示 `Started dev server` 和 `Built extension` 后再安装，端口以当前启动日志为准。服务需要在调试期间持续运行，扩展开发页面会从这里加载模块和 HMR 资源。

WXT 若提示 `Load ".output/chrome-mv3-dev" as an unpacked extension manually`，服务仍然可用，直接交给 MCP 安装即可。目录区别：

| 命令 | 加载目录 |
| --- | --- |
| `pnpm dev:ext` | `.output/chrome-mv3-dev`，依赖正在运行的开发服务 |
| `pnpm build:ext` | `.output/chrome-mv3`，生产构建 |

按以下顺序调用 MCP：

1. `list_pages` 检查连接；`list_extensions` 检查是否已经安装 m-part。
2. 尚未安装时，用 `install_extension({ path: "<项目绝对路径>/.output/chrome-mv3-dev" })`，记录返回的 extension ID；已安装时按需要 `reload_extension({ id: "<extension-id>" })`。
3. `new_page({ url: "chrome-extension://<extension-id>/app.html#/" })` 打开应用，随后用 `list_pages` 获取实际扩展页面的 page ID 与后台 Service Worker ID。
4. `take_snapshot({ pageId })` 获取元素 uid，再用 `fill`、`click`、`hover`、`press_key` 操作。

**不要硬编码 ID**：未打包扩展的 ID 通常随绝对路径而定，换机器或 worktree 会变化，以安装返回值为准。page ID、`sw-*` 和元素 uid 也都只对当前会话/页面状态有效。

`http://localhost:<port>/app.html` 是开发资源入口；验证扩展权限、登录凭据和 DNR 时应打开 `chrome-extension://.../app.html`。扩展使用**哈希路由**，搜索页是 `app.html#/search`。

### 3. 最小冒烟验证

| 检查 | 操作与证据 |
| --- | --- |
| 初始渲染 | 首页、搜索页能显示；`take_snapshot` 和截图均能获取内容 |
| 搜索 | 用 `fill` 输入关键词（例如“周杰伦”），点击搜索或真实按 Enter；等待结果或明确错误态，不能只看到 loading 就结束 |
| 网络 | `list_network_requests` 过滤 `fetch` / `xhr`，检查 nav、search/type、view、playurl；必要时 `get_network_request` 查看响应，HTTP 200 本身不代表业务成功 |
| 播放 | 点击一条结果加入队列，等待音源加载；确认播放进度持续增加，能暂停，音频无 error。CDN 请求可能是 fetch 后转 blob 播放，排查时不要只过滤 media |
| 交互 | 侧栏展开/收起、Tooltip 出现/消失、主题切换，再跨断点缩放；操作后查控制台，不能只查初次加载 |
| 窄屏 | `emulate({ pageId, viewport: "390x844,mobile,touch" })`；比较 `innerWidth` 与 `document.documentElement.scrollWidth`，再结合截图检查布局 |
| 后台 | `evaluate_script` 指定 Service Worker ID，检查 DNR 规则已启用，见下方示例 |

控制台检查用 `list_console_messages({ pageId, types: ["error", "warn"], includeStackTraces: true })`。搜索使用 MCP 的真实输入和点击，避免手动修改 input.value 加合成事件未触发 Solid 的事件委托。主题切换顺序是 system → light → dark → system，一次点击不一定切到深色；结合根元素的 `dark` 类和 `mpart-color-mode` 存储值判断。

在 `evaluate_script` 中传入以下 `function`，并设置 `serviceWorkerId`（不传 pageId），可以确认后台规则：

```js
async () => ({
  name: chrome.runtime.getManifest().name,
  enabledRulesets: await chrome.declarativeNetRequest.getEnabledRulesets(),
})
```

预期返回 `name: "m-part"`、`enabledRulesets: ["bilibili"]`。这证明规则集启用；具体请求是否匹配仍要结合网络请求排查。

### 4. 检查真正的播放器状态

`client/composables/player.ts` 导出模块级 `audio = new Audio()`，它没有挂进 DOM。`document.querySelectorAll('audio, video')` 为空是正常现象。需要深入定位时，在扩展页的 `evaluate_script` 中运行：

```js
async () => {
  const entry = performance.getEntriesByType('resource').find(e =>
    new URL(e.name).pathname.endsWith('/client/composables/player.ts'),
  )
  if (!entry)
    return { playerModuleFound: false }

  // 复用页面已加载的完整模块 URL，不拼一个不同 URL 创建新的状态单例。
  const player = await import(entry.name)
  return {
    queueLength: player.playQueue().length,
    playing: player.playing(),
    paused: player.audio.paused,
    currentTime: player.audio.currentTime,
    duration: player.audio.duration,
    readyState: player.audio.readyState,
    error: player.audio.error && {
      code: player.audio.error.code,
      message: player.audio.error.message,
    },
  }
}
```

这是开发模式的辅助检查。若经过 HMR 后资源记录中有多个该模块 URL，先刷新页面并重新操作再检查，避免读到旧单例。连续检查两次 `currentTime`，结合 `paused: false`、`readyState: 4` 和 `error: null` 判断实际播放；点击后立即读到 `readyState: 0` 可能只是音源还没加载。

### 5. 工具与会话常见问题

- **安装时报 `Target closed`**：调用 `list_pages` 检查浏览器连接，再重试安装。若反复出现，查看浏览器状态和日志，不要无限重试。
- **扩展动作报 `Action can only be triggered on a tab target`**：当前可能选中了 DevTools；先 `select_page` 选普通网页标签再 `trigger_extension_action`。本项目 action 没有 popup，预期是新建应用标签；直接 `new_page` 打开 app.html 也可。
- **`Element with uid ... no longer exists`**：刷新、重连或移动设备模拟后重新 `list_pages` / `take_snapshot`。切换 mobile/touch 模拟可能触发页面刷新，清空搜索和队列等内存状态，需重新输入；不能把这当作普通路由切换丢状态。
- **窗口宽度与页面宽度不一致**：DevTools 停靠和设备像素比会影响截图尺寸；`resize_page` 后用 `innerWidth` 确认实际视口。跨断点验证可用 `emulate` 指定视口，截图像素宽度不能直接当作 CSS 宽度。
- **浏览器实例不同**：WXT 自己启动的 Chrome、MCP 的 Chrome、日常 Chrome 与内置浏览器可能是不同实例；page ID、扩展安装和登录态不能混用。需要登录时在实际调试的实例中登录。
- **截图与收尾**：可保存到被忽略的 `.output/devtools-debug.png`；结束时暂停测试音频，恢复主题/模拟设置或说明保留状态。用户要继续调试时保留服务和扩展标签；说明验证范围。
- **自动生成文件变化**：启动服务可能重排 `client/file-routes.d.ts`。用 `git diff` 判断；仅为调试产生的排序变化不应混入代码提交，处理前确认没有用户改动。

报告调试结果时说明实际验证范围。搜索/播放成功不能代替歌手/专辑详情、音质切换、登录态或异常重试的单独验证；历史验证记录也不代表当前会话已重测。

## 已完成的验证（2026-09）

- dev 模式正常、TSX 正常编译、**搜索出 20 条真实结果** → 免 CORS 与 DNR 注入的 referer / origin 生效
- **playurl 拿到 dash.audio、CDN 音频可播放、切音质正常**
- **登录态确认生效**：CDN 请求 URL 里 `mid=1667458`（非 0）、音质 id `30280`（192K，需登录）
- 因此「playurl 需要 per-video referer」确认不需要做（根 referer 够用），SW 的 session 规则搁置

## 未做

- 扩展图标（WXT 自动识别 `public/icon-*.png`，目前没有，Chrome 用占位图标）
- 登录态 UI、offscreen 后台播放（关闭扩展页即停止播放）

## 附：歌手页「单曲」412 的结论

`/x/space/wbi/arc/search` 偶发 412（HTML 错误页「触发哔哩哔哩安全风控策略」）。排除法实测：

- 请求头里凭据齐全（`buvid3` / `buvid4` / `buvid_fp` / `bili_ticket` / `_uuid`）、DNR 注入的 `referer` / `origin` 在、`wts` + `w_rid` 签名也在 → **buvid 兜底（`chrome.cookies.set`）被证伪**
- 同一签名 URL 带 `credentials: 'include'` 与 `'omit'` **都 412** → 与 cookie 无关；未签名的同一端点也 412 → 与签名无关
- 同一时刻 bilibili **自己的 space 页面**拉列表也是 412 → 不是扩展环境的问题
- 静置一会儿后同一请求又能 200（真实拉到 20 条投稿）

→ **风控是启发式、偶发的**，代码里不做特殊处理，靠错误态兜底（约定见 [AGENTS.md](../AGENTS.md)）。
