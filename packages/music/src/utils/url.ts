/**
 * 把接口返回的资源地址规范成 `https://` 绝对地址。
 *
 * bilibili 的搜索/投稿接口会返回两种不安全写法：
 * - `http://i2.hdslb.com/...`：在安全上下文里（扩展页面 `chrome-extension://`、
 *   或任何 https 部署）会被混合内容策略直接拦掉
 * - `//i2.hdslb.com/...`：协议相对地址在扩展页里会被解析成
 *   `chrome-extension://i2.hdslb.com/...`，连主机都对不上
 *
 * 所以统一在映射结果时补全协议并升级为 https。
 */
export function toHttpsUrl(url?: string): string {
  if (!url)
    return ''
  if (url.startsWith('//'))
    return `https:${url}`
  return url.replace(/^http:\/\//i, 'https://')
}
