import { AES, CBC, Pkcs7, Utf8 } from 'crypto-es'

/**
 * WEAPI 协议参考 NeteaseCloudMusicApiEnhanced/api-enhanced 的 util/crypto.js。
 * 浏览器实现：复用 crypto-es 做 AES，原生 BigInt 做无填充 RSA，随机数来自 Web Crypto。
 * 上游许可见 docs/licenses/netease-api-enhanced.txt。
 */
const PRESET_KEY = Utf8.parse('0CoJUm6Qyw8W8jud')
const IV = Utf8.parse('0102030405060708')
const ALPHABET = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
const RSA_MODULUS = BigInt('0xe0b509f6259df8642dbc35662901477df22677ec152b5ff68ace615bb7b725152b3ab17a876aea8a5aa76d2e417629ec4ee341f56135fccf695280104e0312ecbda92557c93870114af6c9d05c4f7f0c3685b7a46bee255932575cce10b424d813cfe4875d3e82047b97ddef52741d546b8e289dc6935b3ece0462db0a22b8e7')

function randomSecret(): string {
  let secret = ''
  while (secret.length < 16) {
    for (const byte of globalThis.crypto.getRandomValues(new Uint8Array(32))) {
      // 拒绝不能被 62 整除的尾部，避免取模偏差。
      if (byte < 248)
        secret += ALPHABET[byte % 62]
      if (secret.length === 16)
        break
    }
  }
  return secret
}

function encryptSecret(secret: string): string {
  const reversedHex = [...secret].reverse().map(char => char.charCodeAt(0).toString(16)).join('')
  let value = BigInt(`0x${reversedHex}`)
  let exponent = 65537n
  let result = 1n
  while (exponent > 0n) {
    if (exponent & 1n)
      result = result * value % RSA_MODULUS
    value = value * value % RSA_MODULUS
    exponent >>= 1n
  }
  return result.toString(16).padStart(256, '0')
}

export function encryptWeapi(data: Record<string, unknown>): { params: string, encSecKey: string } {
  const secret = randomSecret()
  const first = AES.encrypt(JSON.stringify(data), PRESET_KEY, { iv: IV, mode: CBC, padding: Pkcs7 }).toString()
  return {
    params: AES.encrypt(first, Utf8.parse(secret), { iv: IV, mode: CBC, padding: Pkcs7 }).toString(),
    encSecKey: encryptSecret(secret),
  }
}
