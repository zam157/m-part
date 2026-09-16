import { createRouter } from '@solidjs/router'
import { fileRoutes } from '@solidjs/router/fs'
import { pageRoutes } from 'virtual:file-routes'

/**
 * 基于文件的路由：`client/pages` 由 filesystem-routing 扫描（见 vite.config.ts），
 * 通过 `virtual:file-routes` 暴露给这里，再交给 Solid Router 的 fs 适配器。
 *
 * 文件名约定（与 SolidStart 一致）：
 * - `index.tsx` → `/`
 * - `search.tsx` → `/search`
 * - `album-detail/[provider]/[id].tsx` → `/album-detail/:provider/:id`
 * - `[...all].tsx` → `/*all`
 */
export const Router = createRouter({ routes: fileRoutes(pageRoutes) })
