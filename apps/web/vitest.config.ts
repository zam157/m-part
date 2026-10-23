import { defineConfig } from 'vitest/config'

export default defineConfig({
  root: import.meta.dirname,
  test: { name: 'web-integration', environment: 'node', include: ['test/**/*.test.ts'], testTimeout: 10_000 },
})
