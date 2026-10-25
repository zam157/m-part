import { preparePublicDir } from '@m-part/build-config/assets'
import { defineConfig } from 'wxt'
import { resolveAliases, sharedPlugins } from '@m-part/build-config/vite'

const publicDir = preparePublicDir(import.meta.dirname)

/** Extension shell: manifest, permissions and background script are owned here. */
export default defineConfig({
  srcDir: '.',
  entrypointsDir: 'entrypoints',
  publicDir,
  browser: 'chrome',
  manifestVersion: 3,
  imports: false,

  manifest: {
    // Public key fixes unpacked builds to cjkjimmicmbpjjbopadpdfgpgmgobddl.
    key: 'MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA8oVpudH6BmQX8F6g2eZ6CuW63Uxga0wG5PPhpu3qIwApTt5t789NUIQmNJ7cue4qPlK6aAMtDpvQqe8aTk6v2uGEZsbMv3TWEnq0YAh0q1ybvgWLWfrSkwFGXIO79htCcSKJYDm4I9eT2y6wWK90S/DW37BbR3a4MB9zWTgqZJdg+7Ap+5yqLcxO8/RtCooyYt48RgXb/H09xrcKD9mS0eN4aA492UhsEPYqirCB6jzlaOU7RErFMwXQEvgkv7sYdAcwOP3YN9NKPvD0BFF2NkThuay1k4o/Uo6n+vHgTM0gh3ClpmtJeukH3Fo4nppJOkK9nyYUzVuU6BIfYd69QQIDAQAB',
    name: 'm-part',
    description: '多音源音乐播放器：直接复用浏览器的登录凭据与网络栈，不再需要自建代理',
    minimum_chrome_version: '116',
    // 没有 popup，点击图标交给 background 里的 action.onClicked 处理
    action: { default_title: 'm-part' },
    permissions: ['declarativeNetRequestWithHostAccess', 'cookies'],
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
      'http://127.0.0.1/*',
      'http://localhost/*',
      'https://api.bilibili.com/*',
      'https://*.bilivideo.com/*',
      'https://*.bilivideo.cn/*',
      'https://*.hdslb.com/*',
      'https://music.163.com/*',
      'https://*.music.163.com/*',
      'https://*.music.126.net/*',
      'https://*.y.qq.com/*',
      'https://*.qqmusic.qq.com/*',
      'https://aqqmusic.tc.qq.com/*',
      'https://y.gtimg.cn/*',
    ],
    optional_host_permissions: ['http://*/*', 'https://*/*'],
    declarative_net_request: {
      rule_resources: [
        { id: 'bilibili', enabled: true, path: 'rules/bilibili.json' },
        { id: 'netease', enabled: true, path: 'rules/netease.json' },
        { id: 'qq', enabled: true, path: 'rules/qq.json' },
      ],
    },
  },

  vite: () => ({
    define: {
      'import.meta.env.VITE_TARGET': JSON.stringify('extension'),
    },
    resolve: {
      alias: resolveAliases(),
      dedupe: ['solid-js', '@solidjs/web', '@solidjs/router'],
    },
    plugins: sharedPlugins({ publicDir }),
  }),
})
