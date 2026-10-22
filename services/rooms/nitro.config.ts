import path from 'node:path'
import { defineConfig } from 'nitro'

export default defineConfig({
  serverDir: path.resolve(import.meta.dirname, '../../server/listen'),
  features: { websocket: true },
  preset: 'node-server',
  output: { dir: path.resolve(import.meta.dirname, '../../dist/rooms') },
})
