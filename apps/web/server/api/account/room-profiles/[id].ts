import { defineHandler } from 'nitro'
import { getRouterParam } from 'nitro/h3'
import { roomProfiles } from '../../../account/profiles'

export default defineHandler(event => roomProfiles(event.req, getRouterParam(event, 'id')))
