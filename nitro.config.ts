import { defineConfig } from 'nitro'

export default defineConfig({
  serverDir: './server',
  renderer: {
    template: './index.html', // Path to HTML template file
    static: true, // Treat template as static HTML (no rendu processing)
  },
  output: {
    dir: 'dist/server',
  },
})
