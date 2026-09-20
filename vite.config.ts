/// <reference types="vitest/config" />
// import { playwright } from '@vitest/browser-playwright'
// import { nitro } from 'nitro/vite'
import { defineConfig } from 'vite'
import { resolveAliases, sharedPlugins } from './vite-shared.ts'
// import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  resolve: {
    alias: resolveAliases(),
  },

  build: {
    outDir: 'dist/client',
  },

  plugins: [
    // Solid 编译、文件路由、UnoCSS —— 与扩展构建共用，见 vite-shared.ts
    ...sharedPlugins(),

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

    // nitro(),
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
      // {
      //   test: {
      //     name: 'server',
      //     environment: 'node',
      //     include: ['test/server/**/*.test.ts'],
      //   },
      // },
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
