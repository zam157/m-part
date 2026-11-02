export function normalizeClientCookie(value: string) {
  const text = value.trim().replace(/^cookie\s*:\s*/i, '')
  if (!text.trim()) return ''
  if (text.length > 16_384 || /[\u0000-\u001F\u007F-\uFFFF]/.test(text)) throw new Error('Cookie 格式无效，请填写不含换行的 Cookie 请求头内容（最多 16 KB）')
  const pairs = new Map<string, string>()
  for (const item of text.split(';')) {
    if (!item.trim()) continue
    const index = item.indexOf('=')
    const name = item.slice(0, index).trim(), content = item.slice(index + 1).trim()
    if (index < 1 || !/^[!#$%&'*+.^_`|~\w-]+$/.test(name) || /[\s,;]/.test(content)) throw new Error('Cookie 格式无效，应为 name=value; name2=value2')
    if (!pairs.has(name)) pairs.set(name, content)
  }
  if (!pairs.size) throw new Error('Cookie 格式无效')
  return [...pairs].map(([name, content]) => `${name}=${content}`).join('; ')
}

export function clientCookieValue(cookie: string, name: string) {
  for (const pair of cookie.split(';')) {
    const index = pair.indexOf('=')
    if (pair.slice(0, index).trim() === name) return pair.slice(index + 1).trim()
  }
  return ''
}

