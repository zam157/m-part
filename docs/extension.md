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

- `http://localhost:3001/app.html` —— 看 script src 是否被改写成 dev server URL
- `http://localhost:3001/client/main.tsx` —— 看是否已编译成 `_$createComponent`

验完记得去掉 `disabled`。

**Chrome DevTools MCP（已验证可行）**：

1. `pnpm dev:ext` 起 dev server（WXT 不一定自己拉起浏览器，无所谓）
2. MCP 的 `install_extension` 指向 `.output/chrome-mv3-dev` → 所得 ID 恒为 `elajjgpmoebebhackoafabbkjafecjij`（未打包扩展的 ID = 绝对路径哈希，路径不变 ID 不变）
3. 打开 `chrome-extension://<id>/app.html#/<路由>`；扩展形态是**哈希路由**，切换页面用 `location.hash`

- ⚠️ DevTools MCP 的 Chrome 与 VS Code 内置浏览器是**两个实例**，页面 ID 不能混用
- 合成事件进不了 Solid 的事件委托：要触发搜索请用真实键盘输入，或让 MCP 点击元素本身

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
