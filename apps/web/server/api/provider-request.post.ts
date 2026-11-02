import { defineHandler } from 'nitro'
import { clientCookieProxy } from '../utils/client-cookie-proxy'

export default defineHandler(event => clientCookieProxy(event.req))
