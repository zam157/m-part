import type { ProviderCookieConfig, ProviderDefinition, ProviderName } from '../types/provider'
import { biliDefinition } from './providers/bilibili-definition'
import { neteaseDefinition } from './providers/netease-definition'
import { qqDefinition } from './providers/qq-definition'

// Metadata only: fetch / Web forwarder must never load the Provider implementations.
export const providerDefinitions: Record<ProviderName, ProviderDefinition> = {
  netease: neteaseDefinition,
  qq: qqDefinition,
  bili: biliDefinition,
}

export function getCookieProviders(): { name: ProviderName, cookie: ProviderCookieConfig }[] {
  return Object.values(providerDefinitions).flatMap(definition => definition.cookie ? [{ name: definition.name, cookie: definition.cookie }] : [])
}
