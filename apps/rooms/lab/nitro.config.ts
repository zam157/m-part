import path from 'node:path'
import { defineConfig } from 'nitro'

export default defineConfig({
  serverDir: path.resolve(import.meta.dirname, '../server'),
  errorHandler: path.resolve(import.meta.dirname, '../server/error-handler.ts'),
  features: { websocket: true },
  preset: 'node-server',
  output: { dir: path.resolve(import.meta.dirname, '../dist-lab') },
  publicAssets: [{ dir: path.resolve(import.meta.dirname, '../dist-lab-client'), baseURL: '/' }],
})
