/// <reference types="vitest/config" />
import path from 'node:path'
import solid from '@solidjs/vite-plugin'
// import { playwright } from '@vitest/browser-playwright'
import { fileRoutes } from 'filesystem-routing/vite'
import { nitro } from 'nitro/vite'
import Unocss from 'unocss/vite'
import { defineConfig } from 'vite'
// import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  resolve: {
    alias: {
      '~/': `${path.resolve(import.meta.dirname, 'client')}/`,
      '#shared/': `${path.resolve(import.meta.dirname, 'shared')}/`,
    },
  },

  build: {
    outDir: 'dist/client',
  },

  plugins: [
    solid({
      extensions: ['.jsx', '.tsx'],
      // Solid 编译器默认会省略「唯一属性」的引号（`class="empty"` → `class=empty`），
      // 编译产物里该 token 就没法被 UnoCSS 提取，单 token 的 class 会静默丢样式。
      solid: { omitQuotes: false },
    }),

    // https://github.com/solidjs/filesystem-routing
    // 扫描 client/pages 生成 virtual:file-routes 路由清单
    fileRoutes({
      dir: 'client/pages',
      extensions: ['ts', 'tsx'],
      types: 'client/file-routes.d.ts',
    }),

    // https://github.com/antfu/unocss
    // see uno.config.ts for config
    Unocss(),

    // https://github.com/antfu/vite-plugin-pwa
    // VitePWA({
    //   registerType: 'autoUpdate',
    //   includeAssets: ['favicon.svg', 'safari-pinned-tab.svg'],
    //   manifest: {
    //     name: 'MPart',
    //     short_name: 'MPart',
    //     theme_color: '#ffffff',
    //     icons: [
    //       {
    //         src: '/pwa-192x192.png',
    //         sizes: '192x192',
    //         type: 'image/png',
    //       },
    //       {
    //         src: '/pwa-512x512.png',
    //         sizes: '512x512',
    //         type: 'image/png',
    //       },
    //       {
    //         src: '/pwa-512x512.png',
    //         sizes: '512x512',
    //         type: 'image/png',
    //         purpose: 'any maskable',
    //       },
    //     ],
    //   },
    // }),

    nitro(),
  ],

  // https://github.com/vitest-dev/vitest
  test: {
    // include: ['test/**/*.test.ts'],
    environment: 'jsdom',
    // browser: {
    //   provider: playwright(),
    //   enabled: true,
    //   // at least one instance is required
    //   instances: [{ browser: 'chromium', headless: true }],
    // },
    projects: [
      {
        test: {
          name: 'server',
          environment: 'node',
          include: ['test/server/**/*.test.ts'],
        },
      },
      {
        extends: true,
        test: {
          name: 'client',
          environment: 'jsdom',
          include: ['test/client/**/*.test.ts'],
        },
      },
    ],
  },
  // experimental: {
  //   bundledDev: true,
  // },
})
