import path from 'node:path'
import { defineConfig } from 'nitro'

export default defineConfig({
  serverDir: './server',
  errorHandler: path.resolve(import.meta.dirname, 'server/error-handler.ts'),
  features: { websocket: true },
  preset: 'node-server',
  hooks: {
    'build:before'(nitro) {
      if (nitro.options.preset === 'node-server')
        nitro.options.unenv.push({ polyfill: [path.resolve(import.meta.dirname, 'server-env.ts')] })
    },
  },
  output: { dir: './dist' },
})
