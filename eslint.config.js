// @ts-check
import antfu from '@antfu/eslint-config'

export default antfu(
  {
    markdown: false,
    solid: true,
    unocss: true,
    formatters: true,
    pnpm: true,
    ignores: [
      // 由 filesystem-routing 生成
      'packages/player/src/file-routes.d.ts',
    ],
    rules: {
      'unocss/order': 'off',
    },
  },
)
