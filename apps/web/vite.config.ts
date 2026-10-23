import { defineConfig } from 'vite'
import { preparePublicDir } from '@m-part/build-config/assets'
import { resolveAliases, sharedPlugins } from '@m-part/build-config/vite'

export default defineConfig({
  publicDir: preparePublicDir(import.meta.dirname),
  resolve: { alias: resolveAliases(), dedupe: ['solid-js', '@solidjs/web', '@solidjs/router'] },
  plugins: sharedPlugins({ publicDir: preparePublicDir(import.meta.dirname) }),
  build: { outDir: 'dist/client' },
})
