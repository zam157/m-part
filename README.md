# m-part

多音源音乐播放器。前端是 Solid 2 + Vite，按 Provider 的 API 取数并播放。

音源支持 BiliBili 与网易云音乐；网易云支持歌曲、歌手、专辑搜索和官方音频播放，接入与调试说明见 [网易云音乐音源](./docs/netease.md)。

首页通过统一的 Provider 推荐接口展示 BiliBili 音乐分区榜单和网易云推荐新歌，点击即可加入播放队列；接口与状态约定见 [首页推荐](./docs/recommendations.md)。

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

生产构建（web 形态）产出的是 Nitro 服务端产物：客户端资源在 `dist/server/public/assets`，
HTML 模板被内联进 `dist/server/server/_chunks/renderer-template.mjs`（**没有** index.html 文件）。
`pnpm preview`（`vite preview` 指向 `build.outDir: dist/client`）因此**无效**，冒烟测试请用
`node dist/server/server/index.mjs`（监听 3000）。

## 项目结构

```
m-part/
├─ client/                    前端（Solid 2 + Vite）
│  ├─ main.tsx                挂载入口
│  ├─ App.tsx                 外壳 + 只包内容区的 <Loading> 边界
│  ├─ router.ts               createRouter（扩展形态换成 hashHistory）
│  ├─ file-routes.d.ts        由 filesystem-routing 生成，勿手改
│  ├─ components/             组件：一个目录一个组件（入口为同名 .tsx）
│  │  ├─ MusicPlayer/         播放器（含 components/ 下的音量、音质、展开面板）
│  │  ├─ PlayQueue/           播放队列侧栏
│  │  ├─ ErrorMessage/        加载失败的统一占位（带重试）
│  │  └─ Sidebar/ Tabs/ Pagination/ Popover/ Select/
│  ├─ composables/            模块级共享状态：player、search、dark
│  ├─ pages/                  文件路由：index / search / playground / [...all]
│  │                         / album-detail|artist-detail/[provider]/[id]
│  └─ styles/main.css         全局样式入口
├─ entrypoints/               扩展入口（WXT）
│  ├─ app/index.html          应用页 → 产物 app.html（script 必须用相对路径）
│  └─ background.ts           service worker
├─ shared/                    前后端共用（别名 #shared/*）
│  ├─ types/                  music-info、provider（Provider 接口定义）
│  └─ utils/                  constants（运行形态开关）、fetch（请求 + 扩展策略）、
│                             providers/bilibili.ts（B 站实现）、url、crypto、index
├─ server/                    Nitro（web 形态的代理）
│  ├─ api/hello.ts
│  ├─ api/proxy/              /api/proxy/* 转发（含 bili 分支）
│  └─ utils/proxy.ts
├─ public/                    扩展静态资源（整体拷进扩展根目录）
│  ├─ rules/bilibili.json     DNR 规则：给请求注入 referer / origin
│  ├─ scripts/                color-mode-bootstrap.js（CSP 禁内联脚本）
│  └─ assets/fonts/           由 web-fonts 预设生成，已在 .gitignore 中
├─ test/
│  ├─ client/                 jsdom：composables / utils
│  └─ server/                 node：api（需先跑 pnpm dev）
├─ docs/                      给 agent 与贡献者的笔记（见下方「文档」）
├─ locales/                   旧的 i18n YAML（保留但未接入）
├─ shadcn/                    shadcn 预设的生成器（uno.config.ts 引用）
├─ uno.config.ts              UnoCSS：shadcn 预设 + 快捷方式（btn / card / empty / responsive-cols …）
├─ vite-shared.ts             两套构建共用的别名与插件链（Solid omitQuotes 在这里）
├─ vite.config.ts             web 形态：Vite + Nitro
├─ wxt.config.ts              扩展形态：manifest、host_permissions、VITE_TARGET
├─ web-ext.config.ts          WXT 的浏览器启动配置
└─ tsconfig.*.json            base / frontend / backend / node
```

## 文档

| 文件 | 内容 |
| --- | --- |
| [AGENTS.md](./AGENTS.md) | 给 agent 的工作指南：硬约定、命名约定、完成前自检 |
| [docs/code-style.md](./docs/code-style.md) | 架构、命令、ESLint、Solid 组件写法、依赖管理 |
| [docs/solid-2.md](./docs/solid-2.md) | Solid 2 响应式规则与 API 差异（写入暂存、渲染期禁止写信号 / 读 store、Loading 边界） |
| [docs/styling.md](./docs/styling.md) | 类名合并（`cn/lite` 的 `clsx`）、快捷方式与网格、Popover 定位 |
| [docs/extension.md](./docs/extension.md) | 扩展形态：WXT 配置、传输层、MV3 坑、验证手法、412 调查结论 |
| [docs/netease.md](./docs/netease.md) | 网易云音源：浏览器端 WEAPI、权限、接口、播放限制与验证 |
| [docs/recommendations.md](./docs/recommendations.md) | Provider 推荐接口、首页状态与验证 |

## 已知限制

- `pnpm lint` 不可用：仓库使用 TypeScript 7.x，而 `typescript-eslint` 尚未支持
- 扩展图标尚未提供（manifest 未声明 `icons`，浏览器用占位图标）
- 播放器跑在扩展页面里，关闭页面即停止播放（未使用 offscreen 后台播放）
- `pnpm dev`（web 调试形态）**在开发模式下拿不到数据**：`/api/proxy/*` 请求会被 Vite 的
  HTML fallback 接走（返回 200 + `text/html` 而非 JSON）。要看有数据的界面请用 `pnpm dev:ext`
