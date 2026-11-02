import { expect, it } from 'vitest'
import { providers } from '../src/utils/providers'
import { getCookieProviders, providerDefinitions } from '../src/utils/provider-definitions'
import { providerCookieFilter, providerRequest } from '../src/utils/provider-request'
import { clientCookieRule, setClientCookie } from '../src/utils/client-cookies'

it('shares each registered Provider declaration with transport and reserves stable, unique rule IDs', () => {
  const entries = getCookieProviders()
  expect(Object.keys(providerDefinitions).sort()).toEqual(Object.keys(providers).sort())
  expect(entries).toHaveLength(Object.values(providers).filter(provider => provider.cookie).length)
  for (const { name, cookie } of entries) expect(providers[name].cookie).toBe(cookie)
  expect(new Set(entries.map(entry => entry.cookie.ruleId)).size).toBe(entries.length)
  expect(Object.fromEntries(entries.map(entry => [entry.name, entry.cookie.ruleId]))).toMatchObject({ bili: 11001, netease: 11002, qq: 11003 })
})

it.each([
  ['https://api.bilibili.com/x/web-interface/nav', 'bili'],
  ['https://music.163.com/weapi/w/nuser/account/get', 'netease'],
  ['https://c.y.qq.com/soso/fcgi-bin/client_search_cp', 'qq'],
  ['https://c.y.qq.com/qzone/test', 'qq'],
  ['https://c.y.qq.com/rsc/test', 'qq'],
  ['https://c.y.qq.com/splcloud/test', 'qq'],
  ['https://c.y.qq.com/v8/test', 'qq'],
  ['https://u.y.qq.com/cgi-bin/musicu.fcg?format=json', 'qq'],
  ['https://u.y.qq.com/cgi-bin/musicu.fcg/other', undefined],
  ['https://u.y.qq.com/cgi-bin/musicu.fcg.evil', undefined],
  ['https://c.y.qq.com/soso-other/test', undefined],
  ['https://api.bilibili.com.evil.example/x/test', undefined],
  ['https://music.163.com/weapi-other/test', undefined],
  ['https://music.163.com:8443/weapi/test', undefined],
  ['https://music.163.com/artwork.jpg', undefined],
  ['http://localhost:3410/room-control', undefined],
])('generates the same API scope for native extension rules and Web forwarding: %s', (url, source) => {
  expect(providerRequest(url)?.provider).toBe(source)
  const matches = getCookieProviders().filter(({ cookie }) => new RegExp(providerCookieFilter(cookie)).test(url)).map(entry => entry.name)
  expect(matches).toEqual(source ? [source] : [])
})

it('allows an undeclared Cookie capability to opt out of settings, requests and manual sessions', async () => {
  const previous = providerDefinitions.bili
  try {
    providerDefinitions.bili = { name: 'bili' }
    expect(getCookieProviders().some(entry => entry.name === 'bili')).toBe(false)
    expect(providerRequest('https://api.bilibili.com/x/web-interface/nav')).toBeUndefined()
    expect(() => clientCookieRule('bili', 'session=test', 'extension')).toThrow('不支持手动 Cookie')
    await expect(setClientCookie('bili', 'session=test')).rejects.toThrow('不支持手动 Cookie')
  }
  finally { providerDefinitions.bili = previous }
})

it('honors a provider-defined API scope without adding platform branches to consumers', () => {
  const previous = providerDefinitions.bili
  try {
    const cookie = { ...previous.cookie!, ruleId: 11090, targets: [{ origin: 'https://audio.example.test', path: '/api/v1/' }] } as const
    providerDefinitions.bili = { name: 'bili', cookie }
    expect(providerRequest('https://audio.example.test/api/v1/profile')?.provider).toBe('bili')
    expect(providerRequest('https://api.bilibili.com/x/web-interface/nav')).toBeUndefined()
    const rule = clientCookieRule('bili', 'session=test', 'extension')
    expect(rule.id).toBe(11090)
    expect(new RegExp(rule.condition.regexFilter).test('https://audio.example.test/api/v1/profile')).toBe(true)
    expect(new RegExp(rule.condition.regexFilter).test('https://audio.example.test/api/v2/profile')).toBe(false)
  }
  finally { providerDefinitions.bili = previous }
})
