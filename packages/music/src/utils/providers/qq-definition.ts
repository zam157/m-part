import type { ProviderDefinition } from '../../types/provider'

export const qqDefinition = {
  name: 'qq',
  cookie: {
    label: 'QQ 音乐',
    placeholder: 'qqmusic_uin=…; qqmusic_key=…',
    loginUrl: 'https://y.qq.com/',
    requestOrigin: 'https://y.qq.com',
    ruleId: 11003,
    session: { names: ['qqmusic_uin', 'uin', 'wxuin', 'qqmusic_key', 'qm_keyst', 'p_skey', 'skey', 'eas_sid', 'login_type', 'tmeLoginType'], required: [['qqmusic_uin', 'uin', 'wxuin'], ['qqmusic_key', 'qm_keyst', 'p_skey', 'skey']], loginIndicators: ['qqmusic_key', 'qm_keyst', 'p_skey', 'skey'], urls: ['https://y.qq.com/', 'https://u.y.qq.com/cgi-bin/musicu.fcg', 'https://c.y.qq.com/'], domains: ['qq.com'] },
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
