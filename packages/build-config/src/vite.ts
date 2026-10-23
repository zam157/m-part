import path from 'node:path'
import solid from '@solidjs/vite-plugin'
import { fileRoutes } from 'filesystem-routing/vite'
import Unocss from 'unocss/vite'
import type { PluginOption } from 'vite'
import { createUnoConfig } from './uno.ts'

const playerDir = path.resolve(import.meta.dirname, '../../player/src')

/** Only package-local imports use ~; cross-package imports use workspace exports. */
export function resolveAliases() {
  return { '~/': `${playerDir}/` }
}

/** Both client shells compile the same player source, including routes and CSS. */
export function sharedPlugins(options: { publicDir?: string, routes?: boolean, styles?: boolean } = {}): PluginOption[] {
  return [
    // Required for UnoCSS to extract single-token classes from Solid's output.
    solid({ extensions: ['.jsx', '.tsx'], solid: { omitQuotes: false } }),
    options.routes !== false && fileRoutes({
      dir: path.join(playerDir, 'pages'),
      extensions: ['ts', 'tsx'],
      types: path.join(playerDir, 'file-routes.d.ts'),
    }),
    options.styles !== false && Unocss(createUnoConfig(options.publicDir)),
  ]
}
