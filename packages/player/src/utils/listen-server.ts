/** Room endpoints accept either HTTP or HTTPS; the client selects WS or WSS. */
export function normalizeRoomServer(input: string) {
  const url = new URL(input.trim())
  if (url.username || url.password || url.search || url.hash || (url.pathname !== '/' && url.pathname !== '')) throw new Error('服务器地址只填写域名和端口，不包含路径或凭据')
  if (url.protocol !== 'http:' && url.protocol !== 'https:') throw new Error('房间服务器地址必须使用 HTTP 或 HTTPS')
  return url.origin
}
