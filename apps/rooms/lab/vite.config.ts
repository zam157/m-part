import path from 'node:path'
import { defineConfig } from 'vite'
import { sharedPlugins } from '@m-part/build-config/vite'
import { preparePublicDir } from '@m-part/build-config/assets'

const publicDir = preparePublicDir(import.meta.dirname)

export default defineConfig({
  root: path.resolve(import.meta.dirname, 'client'),
  publicDir,
  plugins: sharedPlugins({ publicDir, routes: false }),
  build: { outDir: path.resolve(import.meta.dirname, '../dist-lab-client'), emptyOutDir: true },
})
