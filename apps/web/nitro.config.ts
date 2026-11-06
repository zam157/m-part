import path from 'node:path'
import { defineConfig } from 'nitro'

export default defineConfig({
  builder: 'rolldown',
  hooks: {
    'build:before'(nitro) {
      if (nitro.options.preset === 'node-server')
        nitro.options.unenv.push({ polyfill: [path.resolve(import.meta.dirname, 'server-env.ts')] })
    },
  },
  serverDir: './server',
  renderer: { template: './dist/client/index.html', static: true },
  alias: { '#server/': `${path.resolve(import.meta.dirname, 'server')}/` },
  publicAssets: [{ dir: path.resolve(import.meta.dirname, 'dist/client'), baseURL: '/' }],
  output: {
    dir: path.resolve(import.meta.dirname, 'dist/server'),
    serverDir: path.resolve(import.meta.dirname, 'dist/server'),
    publicDir: path.resolve(import.meta.dirname, 'dist/public'),
  },
})
