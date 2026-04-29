import { defineHandler } from 'nitro'

export default defineHandler(async (event) => {
  const { method } = event.req
  const queries = Object.fromEntries(event.url.searchParams)
  const body = await event.req.json()
  return {
    method,
    queries,
    body,
  }
})
