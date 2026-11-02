import type { ProviderDefinition } from '../../types/provider'

export const qqDefinition = {
  name: 'qq',
  cookie: {
    label: 'QQ 音乐',
    placeholder: 'qqmusic_uin=…; qqmusic_key=…',
    loginUrl: 'https://y.qq.com/',
    requestOrigin: 'https://y.qq.com',
    ruleId: 11003,
    targets: [
      { origin: 'https://c.y.qq.com', path: '/soso/' },
      { origin: 'https://c.y.qq.com', path: '/qzone/' },
      { origin: 'https://c.y.qq.com', path: '/rsc/' },
      { origin: 'https://c.y.qq.com', path: '/splcloud/' },
      { origin: 'https://c.y.qq.com', path: '/v8/' },
      { origin: 'https://u.y.qq.com', path: '/cgi-bin/musicu.fcg', exact: true },
    ],
  },
} satisfies ProviderDefinition
