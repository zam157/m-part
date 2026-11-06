import { defineHandler } from 'nitro'
import { providerMediaProxy } from '../utils/provider-media-proxy'

export default defineHandler(event => providerMediaProxy(event.req))
