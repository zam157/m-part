import { BlockList, isIP } from 'node:net'

const localAddresses = new BlockList()
localAddresses.addSubnet('127.0.0.0', 8)
localAddresses.addSubnet('10.0.0.0', 8)
localAddresses.addSubnet('172.16.0.0', 12)
localAddresses.addSubnet('192.168.0.0', 16)
localAddresses.addSubnet('169.254.0.0', 16)
localAddresses.addAddress('::1', 'ipv6')
localAddresses.addSubnet('fc00::', 7, 'ipv6')
localAddresses.addSubnet('fe80::', 10, 'ipv6')

/** Explicit allowlists take precedence; private-address servers allow any Chrome extension ID. */
export function isRoomOriginAllowed(requestUrl: string, origin: string | null, allowedOrigins?: string) {
  if (!origin) return false
  if (allowedOrigins !== undefined) return allowedOrigins.split(',').some(value => value.trim() === origin)

  const url = new URL(requestUrl)
  const host = url.hostname.replace(/^\[|\]$/g, '')
  const family = isIP(host)
  const local = host === 'localhost' || !!family && localAddresses.check(host, family === 6 ? 'ipv6' : 'ipv4')
  return local && (origin === url.origin || /^chrome-extension:\/\/[a-p]{32}$/.test(origin))
}
