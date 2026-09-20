import { defineWebExtConfig } from 'wxt'

/**
 * `pnpm dev:ext` 的浏览器启动配置。
 *
 * WXT 默认用一次性的临时 Chrome 配置启动，因此**没有**你日常浏览器里的登录态。
 * 打开 `keepProfileChanges` 后，只需在那个窗口里登录一次 bilibili，
 * 之后每次 dev 都会沿用 —— 登录 cookie 正是本项目在扩展形态下最需要验证的东西。
 *
 * 如果想直接用日常 Chrome 的配置，可以额外设置 `chromiumProfile`（注意需要先关掉
 * 正在运行的 Chrome，否则配置目录会被锁）。
 */
export default defineWebExtConfig({
  keepProfileChanges: true,
})
