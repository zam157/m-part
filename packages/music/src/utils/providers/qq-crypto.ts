/** QQ 网页使用的 DJB2 CSRF token；不是登录凭据的替代品。 */
export function qqToken(key: string): number {
  let hash = 5381
  for (let index = 0; index < key.length; index++) hash = (hash * 33 + key.charCodeAt(index)) | 0
  return hash & 0x7FFFFFFF
}

