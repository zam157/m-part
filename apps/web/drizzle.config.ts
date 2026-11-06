import { existsSync } from 'node:fs'
import { defineConfig } from 'drizzle-kit'

if (existsSync('.env.local')) process.loadEnvFile('.env.local')

export default defineConfig({
  dialect: 'postgresql',
  schema: './server/account/schema.ts',
  out: './drizzle',
  dbCredentials: process.env.DATABASE_URL ? { url: process.env.DATABASE_URL } : undefined,
})
