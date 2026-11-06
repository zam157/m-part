import { defineHandler } from 'nitro'
import { roomProfiles } from '../../../account/profiles'

export default defineHandler(event => roomProfiles(event.req))
