import { defineHandler } from 'nitro'

export default defineHandler(() => Response.json({ version: 1 }, { headers: { 'cache-control': 'no-store' } }))
