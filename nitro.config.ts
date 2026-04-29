import path from 'node:path'
import { defineConfig } from 'nitro'

export default defineConfig({
  serverDir: './server',
  renderer: {
    template: './index.html', // Path to HTML template file
    static: true, // Treat template as static HTML (no rendu processing)
  },
  alias: {
    '#server/*': `${path.resolve(__dirname, 'server')}/`,
    '#shared/*': `${path.resolve(__dirname, 'shared')}/`,
  },
  output: {
    dir: 'dist/server',
  },
})
