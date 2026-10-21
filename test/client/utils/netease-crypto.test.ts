// @vitest-environment node
import { constants, createCipheriv, publicEncrypt } from 'node:crypto'
import { encryptWeapi } from '#shared/utils/providers/netease-crypto'
import { afterEach, describe, expect, it, vi } from 'vitest'

const PUBLIC_KEY = `-----BEGIN PUBLIC KEY-----
MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQDgtQn2JZ34ZC28NWYpAUd98iZ37BUrX/aKzmFbt7clFSs6sXqHauqKWqdtLkF2KexO40H1YTX8z2lSgBBOAxLsvaklV8k4cBFK9snQXE9/DDaFt6Rr7iVZMldczhC0JNgTz+SHXT6CBHuX3e9SdB1Ua44oncaTWz7OBGLbCiK45wIDAQAB
-----END PUBLIC KEY-----`

function aes(text: string, key: string): string {
  const cipher = createCipheriv('aes-128-cbc', key, '0102030405060708')
  return Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]).toString('base64')
}

describe('WEAPI 浏览器加密', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('与独立的 OpenSSL AES-CBC 和无填充 RSA 实现一致（含中文）', () => {
    vi.stubGlobal('crypto', { getRandomValues: (array: Uint8Array) => array.fill(0) })
    const data = { s: '许嵩', type: 1, csrf_token: '' }
    const secret = 'aaaaaaaaaaaaaaaa'
    const rsaInput = Buffer.alloc(128)
    Buffer.from(secret.split('').reverse().join('')).copy(rsaInput, 112)
    expect(encryptWeapi(data)).toEqual({
      params: aes(aes(JSON.stringify(data), '0CoJUm6Qyw8W8jud'), secret),
      encSecKey: publicEncrypt({ key: PUBLIC_KEY, padding: constants.RSA_NO_PADDING }, rsaInput).toString('hex'),
    })
  })

  it('每次请求使用新随机密钥，RSA 字段保持 256 位十六进制', () => {
    const first = encryptWeapi({ s: 'test' })
    const second = encryptWeapi({ s: 'test' })
    expect(first.params).not.toBe(second.params)
    expect(first.encSecKey).not.toBe(second.encSecKey)
    expect(first.encSecKey).toMatch(/^[\da-f]{256}$/)
  })
})
