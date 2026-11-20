import { defineConfig } from 'vite'
import { nitro } from 'nitro/vite'
import { preparePublicDir } from '@m-part/build-config/assets'
import { resolveAliases, sharedPlugins } from '@m-part/build-config/vite'

export default defineConfig(({ command }) => ({
  publicDir: preparePublicDir(import.meta.dirname),
  resolve: { alias: resolveAliases(), dedupe: ['solid-js', '@solidjs/web', '@solidjs/router'] },
  plugins: [
    command === 'serve' && nitro({ renderer: { template: './index.html' } }),
    ...sharedPlugins({ publicDir: preparePublicDir(import.meta.dirname) }),
  ],
  appType: 'spa',
  // Nitro's Vite plugin also serves this directory if it is set during development.
  build: command === 'build' ? { outDir: 'dist/client' } : undefined,
}))
