import path from 'node:path'
import solid from '@solidjs/vite-plugin'
import { fileRoutes } from 'filesystem-routing/vite'
import Unocss from 'unocss/vite'
import type { PluginOption } from 'vite'

/**
 * web 构建（`vite.config.ts`）与扩展构建（`vite.config.extension.ts`）共用的
 * 解析别名与插件链。
 *
 * 抽成模块而不是各自复制一份，是因为这里有两条**不能漏**的约束：
 * 1. `solid({ solid: { omitQuotes: false } })`：Solid 编译器默认会省略「唯一属性」
 *    的引号（`class="empty"` → `class=empty`），编译产物里该 token 就没法被
 *    UnoCSS 提取，单 token 的 class 会静默丢样式。
 * 2. `fileRoutes` 的 `types` 输出路径固定为 `client/file-routes.d.ts`（勿手改）。
 */
export function resolveAliases() {
  return {
    '~/': `${path.resolve(import.meta.dirname, 'client')}/`,
    '#shared/': `${path.resolve(import.meta.dirname, 'shared')}/`,
  }
}

export function sharedPlugins(): PluginOption[] {
  return [
    solid({
      extensions: ['.jsx', '.tsx'],
      solid: { omitQuotes: false },
    }),

    // https://github.com/solidjs/filesystem-routing
    // 扫描 client/pages 生成 virtual:file-routes 路由清单
    fileRoutes({
      dir: 'client/pages',
      extensions: ['ts', 'tsx'],
      types: 'client/file-routes.d.ts',
    }),

    // https://github.com/antfu/unocss
    // see uno.config.ts for config
    Unocss(),
  ]
}
