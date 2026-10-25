import { defineHandler } from 'nitro'
import { hostedMedia } from '../utils/runtime'
import { createRoomControlHandler } from '../utils/room-http'

const control = createRoomControlHandler(hostedMedia, {
  allowedOrigins: () => process.env.LISTEN_ALLOWED_ORIGINS,
})
export default defineHandler(event => control(event.req))
