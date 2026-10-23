import { defineHandler } from 'nitro'
import { LISTEN_PROTOCOL } from '@m-part/listen-core/protocol'

export default defineHandler(() => ({ service: 'm-part rooms', protocol: LISTEN_PROTOCOL, sourceMode: 'independent' }))
