import path from 'node:path'
import { defineConfig } from 'nitro'

export default defineConfig({
  serverDir: './server',
  errorHandler: path.resolve(import.meta.dirname, 'server/error-handler.ts'),
  features: { websocket: true },
  preset: 'node-server',
  output: { dir: './dist' },
})
