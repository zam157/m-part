import { defineConfig } from 'vitest/config'
import { resolveAliases, sharedPlugins } from '@m-part/build-config/vite'

export default defineConfig({
  root: import.meta.dirname,
  resolve: { alias: resolveAliases(), dedupe: ['solid-js', '@solidjs/web', '@solidjs/router'] },
  plugins: sharedPlugins({ routes: false, styles: false }),
  test: { name: 'player', environment: 'jsdom', include: ['test/**/*.test.ts'] },
})
