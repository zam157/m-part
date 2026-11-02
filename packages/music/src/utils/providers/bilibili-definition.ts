import type { ProviderDefinition } from '../../types/provider'

export const biliDefinition = {
  name: 'bili',
  cookie: {
    label: 'BiliBili',
    placeholder: 'SESSDATA=…; bili_jct=…',
    loginUrl: 'https://www.bilibili.com/',
    requestOrigin: 'https://www.bilibili.com',
    ruleId: 11001,
    targets: [{ origin: 'https://api.bilibili.com', path: '/x/' }],
  },
} satisfies ProviderDefinition
