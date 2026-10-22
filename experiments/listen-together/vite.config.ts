import path from 'node:path'
import { defineConfig } from 'vite'

export default defineConfig({
  root: path.resolve(import.meta.dirname, 'client'),
  build: { outDir: path.resolve(import.meta.dirname, '../../dist/listen-client'), emptyOutDir: true },
})
