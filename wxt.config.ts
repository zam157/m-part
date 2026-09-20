import { defineConfig } from 'wxt'
import { resolveAliases, sharedPlugins } from './vite-shared'

/**
 * 浏览器扩展（MV3）的开发与构建配置：`pnpm dev:ext` / `pnpm build:ext`。
 *
 * WXT 负责产物的组织方式（`entrypoints/` 约定、由配置生成 manifest、
 * dev server 提供 HMR），Solid 编译 / 文件路由 / UnoCSS 仍由 `vite-shared.ts`
 * 里的插件链提供，与 web 构建共用同一份配置。
 *
 * 几个刻意的选择：
 * - `imports: false`：仓库约定不使用自动导入（见 copilot-instructions）
 * - 不继承 WXT 生成的 `.wxt/tsconfig.json`：它把 `~` 映射到 srcDir，
 *   会与仓库既有的 `~/` → `client/` 冲突；别名统一由 `vite-shared.ts` 提供
 * - `define` 注入 `VITE_TARGET=extension`，运行时代码据此切换语境
 *   （见 `shared/utils/constants.ts` 的 `TARGET_EXTENSION`）
 */
export default defineConfig({
  srcDir: '.',
  entrypointsDir: 'entrypoints',
  publicDir: 'public',
  browser: 'chrome',
  manifestVersion: 3,
  imports: false,

  manifest: {
    name: 'm-part',
    description: '多音源音乐播放器：直接复用浏览器的登录凭据与网络栈，不再需要自建代理',
    minimum_chrome_version: '116',
    // 没有 popup，点击图标交给 background 里的 action.onClicked 处理
    action: { default_title: 'm-part' },
    permissions: ['declarativeNetRequestWithHostAccess'],
    // 音频 CDN 必须逐一列全：playurl 会返回 bilivideo.com（upos 镜像）或
    // mcdn.bilivideo.cn 之类的地址。**漏掉域名不会报权限错误**，而是该请求
    // 不再豁免 CORS，表现为浏览器报
    // "The value of the 'Access-Control-Allow-Origin' header ... must not be the
    //  wildcard '*' when the request's credentials mode is 'include'"，
    // 很容易误判成 CDN 不支持跨域。新增 CDN 域名时两处都要改（这里是权限，
    // public/rules/bilibili.json 里是注入 referer 的规则）。
    // 已知还有 Akamai 镜像（*.akamaized.net，主要给海外用户），暂不申请这么宽的
    // 权限；等日志里真出现该域名的 CORS 报错再按需加
    host_permissions: [
      'https://api.bilibili.com/*',
      'https://*.bilivideo.com/*',
      'https://*.bilivideo.cn/*',
      'https://*.hdslb.com/*',
    ],
    declarative_net_request: {
      rule_resources: [
        { id: 'bilibili', enabled: true, path: 'rules/bilibili.json' },
      ],
    },
  },

  vite: () => ({
    define: {
      'import.meta.env.VITE_TARGET': JSON.stringify('extension'),
    },
    resolve: {
      alias: resolveAliases(),
    },
    plugins: sharedPlugins(),
  }),
})
