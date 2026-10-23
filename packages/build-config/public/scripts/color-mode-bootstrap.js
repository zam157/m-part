/**
 * 深色模式引导脚本：必须在首屏绘制前**同步**执行，否则会闪一下亮色主题。
 *
 * 之所以放在 `public/` 下当作普通脚本引入，而不是写进 `index.html` 内联：
 * MV3 扩展页面的默认 CSP 是 `script-src 'self'`，内联脚本会直接被拒绝；
 * 而 `<script type="module">` 是延迟执行的，无法保证在首次绘制前跑完。
 *
 * 这里的 key 与 `client/composables/dark.ts` 的 `COLOR_MODE_KEY` 必须一致。
 */
(function () {
  if (!window.matchMedia)
    return
  const darkModeMediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
  const prefersDark = darkModeMediaQuery ? darkModeMediaQuery.matches : false
  const setting = localStorage.getItem('mpart-color-mode') || 'system'
  if (setting === 'dark' || (prefersDark && setting !== 'light'))
    document.documentElement.classList.toggle('dark', true)
})()
