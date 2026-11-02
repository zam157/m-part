import type { ProviderDefinition } from '../../types/provider'

export const neteaseDefinition = {
  name: 'netease',
  cookie: {
    label: '网易云',
    placeholder: 'MUSIC_U=…; __csrf=…',
    loginUrl: 'https://music.163.com/',
    requestOrigin: 'https://music.163.com',
    ruleId: 11002,
    targets: [{ origin: 'https://music.163.com', path: '/weapi/' }],
    session: { names: ['MUSIC_U', '__csrf'], required: [['MUSIC_U']], urls: ['https://music.163.com/weapi/w/nuser/account/get', 'https://music.163.com/'], domains: ['music.163.com'] },
  },
} satisfies ProviderDefinition
