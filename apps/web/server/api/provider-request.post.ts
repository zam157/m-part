import { defineHandler } from 'nitro'
import { providerApiProxy } from '../utils/provider-api-proxy'

export default defineHandler(event => providerApiProxy(event.req))
