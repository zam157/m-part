export const USE_PROXY = import.meta.env.VITE_USE_PROXY === '1'
export const USE_GM_FETCH = import.meta.env.VITE_USE_GM_FETCH === '1'

/**
 * 是否浏览器扩展形态（`vite build --config apps/extension/wxt.config.ts`）。
 *
 * 扩展页面与 service worker 都处于扩展源，只要 manifest 声明了 `host_permissions`，
 * 跨域请求就不受 CORS 限制；登录凭据由 `credentials: 'include'` 自动携带。
 * 但 `cookie`/`referer`/`origin`/`user-agent` 属于 forbidden header，fetch 无法设置，
 * 交由 `declarativeNetRequest` 规则注入（见 `extension/rules/`）。
 */
export const TARGET_EXTENSION = import.meta.env.VITE_TARGET === 'extension'
