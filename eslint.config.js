// @ts-check
import antfu from '@antfu/eslint-config'

export default antfu(
  {
    unocss: true,
    formatters: true,
    pnpm: true,
    ignores: [
      'pnpm-workspace.yaml',
    ],
    rules: {
      'vue/attribute-hyphenation': ['warn', 'never'],
      'vue/v-on-event-hyphenation': ['warn', 'never'],
    },
  },
)
