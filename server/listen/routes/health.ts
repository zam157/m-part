import { defineHandler } from 'nitro'
import { LISTEN_PROTOCOL } from '../../../shared/types/listen-room'

export default defineHandler(() => ({ service: 'm-part rooms', protocol: LISTEN_PROTOCOL, sourceMode: 'independent' }))
