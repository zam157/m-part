/// <reference types="vitest/config" />
import path from 'node:path'
import VueI18n from '@intlify/unplugin-vue-i18n/vite'
import { unheadVueComposablesImports } from '@unhead/vue'
import Vue from '@vitejs/plugin-vue'
import { playwright } from '@vitest/browser-playwright'
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
      '~/': `${path.resolve(__dirname, 'src')}/`,
    },
  },

  plugins: [
    VueRouter({
      extensions: ['.vue', '.md'],
      dts: 'src/typed-router.d.ts',
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
      dts: 'src/auto-imports.d.ts',
      dirs: [
        // 'src/composables',
        // 'src/stores',
      ],
      vueTemplate: true,
    }),

    // https://github.com/antfu/unplugin-vue-components
    // Components({
    //   // allow auto load markdown components under `./src/components/`
    //   extensions: ['vue', 'md'],
    //   // allow auto import and register components used in markdown
    //   include: [/\.vue$/, /\.vue\?vue/, /\.md$/],
    //   dts: 'src/components.d.ts',
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
      include: [path.resolve(__dirname, 'locales/**')],
    }),
  ],

  // https://github.com/vitest-dev/vitest
  test: {
    include: ['test/**/*.test.ts'],
    environment: 'jsdom',
    browser: {
      provider: playwright(),
      enabled: true,
      // at least one instance is required
      instances: [{ browser: 'chromium', headless: true }],
    },
  },
})
