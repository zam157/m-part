import { defineConfig } from 'vitest/config'

export default defineConfig({
  root: import.meta.dirname,
  test: { name: 'music', environment: 'jsdom', include: ['test/**/*.test.ts'], testTimeout: 10_000 },
})
