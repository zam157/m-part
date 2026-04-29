// import mcdApi from '@neteasecloudmusicapienhanced/api'
import { defineHandler } from 'nitro'

export default defineHandler(async (event) => {
  const { method } = event.req
  const queries = Object.fromEntries(event.url.searchParams)
  const body = await event.req.json()
  // const res = await mcdApi.banner({ type: 0 })
  return {
    method,
    queries,
    body,
  }
})
