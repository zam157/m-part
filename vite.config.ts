/// <reference types="vitest/config" />
import path from 'node:path'
import VueI18n from '@intlify/unplugin-vue-i18n/vite'
import { unheadVueComposablesImports } from '@unhead/vue'
import Vue from '@vitejs/plugin-vue'
// import { playwright } from '@vitest/browser-playwright'
import { nitro } from 'nitro/vite'
import Unocss from 'unocss/vite'
import AutoImport from 'unplugin-auto-import/vite'
// import Components from 'unplugin-vue-components/vite'
import { defineConfig } from 'vite'
// import { VitePWA } from 'vite-plugin-pwa'
import { VueRouterAutoImports } from 'vue-router/unplugin'
import VueRouter from 'vue-router/vite'

export default defineConfig({
  resolve: {
    alias: {
      '~/': `${path.resolve(__dirname, 'client')}/`,
      '#shared/': `${path.resolve(__dirname, 'shared')}/`,
    },
  },

  build: {
    outDir: 'dist/client',
  },

  plugins: [
    VueRouter({
      routesFolder: 'client/pages',
      extensions: ['.vue', '.md'],
      dts: 'client/typed-router.d.ts',
    }),

    Vue({
      include: [/\.vue$/, /\.md$/],
    }),

    // https://github.com/antfu/unplugin-auto-import
    AutoImport({
      include: [/\.[jt]sx?$/, /\.vue$/, /\.vue\?vue/, /\.md$/],
      imports: [
        'vue',
        'vue-i18n',
        '@vueuse/core',
        unheadVueComposablesImports,
        VueRouterAutoImports,
        {
          // add any other imports you were relying on
          'vue-router/auto': ['useLink'],
        },
      ],
      dts: 'client/auto-imports.d.ts',
      dirs: [
        // 'client/composables',
        // 'client/stores',
      ],
      vueTemplate: true,
    }),

    // https://github.com/antfu/unplugin-vue-components
    // Components({
    //   // allow auto load markdown components under `./client/components/`
    //   extensions: ['vue', 'md'],
    //   // allow auto import and register components used in markdown
    //   include: [/\.vue$/, /\.vue\?vue/, /\.md$/],
    //   dts: 'client/components.d.ts',
    // }),

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

    // https://github.com/intlify/bundle-tools/tree/main/packages/unplugin-vue-i18n
    VueI18n({
      runtimeOnly: true,
      compositionOnly: true,
      fullInstall: true,
      include: [path.resolve(__dirname, 'client/locales/**')],
    }),

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
})
