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
    session: { names: ['SESSDATA', 'bili_jct', 'DedeUserID', 'DedeUserID__ckMd5', 'buvid3', 'buvid4'], required: [['SESSDATA']] },
  },
} satisfies ProviderDefinition
