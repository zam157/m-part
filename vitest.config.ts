import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: { projects: ['packages/player', 'packages/music', 'packages/listen-core', 'apps/rooms', 'apps/rooms/lab'] },
})
