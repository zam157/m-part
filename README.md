# m-part

多音源音乐播放器。前端是 Solid 2 + Vite，按 Provider 的 API 取数并播放。

## 两种运行形态

| | 扩展形态（推荐） | web 调试形态 |
| --- | --- | --- |
| 入口 | `pnpm dev:ext` / `pnpm build:ext`（WXT） | `pnpm dev` / `pnpm build`（Vite + Nitro） |
| 取数方式 | 扩展页面直接请求站点 API | 走 Nitro 代理绕 CORS |
| 登录态 | 浏览器 cookie 自动携带 | 无（需要手动塞凭据） |

扩展形态是当前的主线：扩展源在 manifest 声明 `host_permissions` 后不受 CORS 限制，
登录凭据由 `credentials: 'include'` 自动携带，`referer` / `origin` 这类 fetch 设不了的
请求头由 `declarativeNetRequest` 规则注入（`public/rules/bilibili.json`）。
web 形态保留作为纯 UI 调试入口 —— 浏览器里直连 `api.bilibili.com` 会被 CORS 拦掉，
所以那条路径只能配合 `server/` 下的代理使用。

## 开发

```bash
pnpm install

pnpm dev:ext     # 扩展开发模式：启动 dev server 并拉起 Chrome，改代码即时热更新
pnpm build:ext   # 产出可加载的扩展目录 .output/chrome-mv3
```

`pnpm dev:ext` 使用 WXT，它会用**独立的 Chrome 配置**启动浏览器（`web-ext.config.ts` 里
已打开 `keepProfileChanges`）。要验证登录相关的行为，需要在这个窗口里登录一次 bilibili，
之后登录态会保留。

加载已构建的扩展：`chrome://extensions` → 打开「开发者模式」→「加载已解压的扩展程序」→
选择 `.output/chrome-mv3`。安装后点击工具栏图标会打开应用页（`app.html`）。

## 检查

```bash
pnpm typecheck   # tsc --build（前端 / 服务端 / 构建配置三个项目）
pnpm test        # vitest：test/client（jsdom）+ test/server（node）
```

`pnpm test server` 里的 hello 用例会真实请求 `http://localhost:3333/api/hello`，
需要先跑 `pnpm dev`，否则报 `ECONNREFUSED`。

## 已知限制

- `pnpm lint` 不可用：仓库使用 TypeScript 7.x，而 `typescript-eslint` 尚未支持
- 扩展图标尚未提供（manifest 未声明 `icons`，浏览器用占位图标）
- 播放器跑在扩展页面里，关闭页面即停止播放（未使用 offscreen 后台播放）
