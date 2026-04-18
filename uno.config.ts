import {
  defineConfig,
  presetIcons,
  presetTypography,
  presetWebFonts,
  presetWind4,
  transformerDirectives,
  transformerVariantGroup,
} from 'unocss'
import { presetShadcn } from 'unocss-preset-shadcn'

export default defineConfig({
  shortcuts: [
    ['btn', 'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors disabled:pointer-events-none disabled:opacity-50 outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] hover:bg-accent hover:text-accent-foreground dark:hover:bg-accent/50'],
  ],
  presets: [
    presetWind4({
      reset: true,
    }),
    presetShadcn({
      color: 'neutral',
    }),
    presetIcons(),
    presetTypography(),
    presetWebFonts({
      themeKey: 'font',
      fonts: {
        sans: 'DM Sans',
        serif: 'DM Serif Display',
        mono: 'Roboto Mono',
      },
    }),
  ],
  theme: {
    property: {
      'display': 'display',
      '[display,opacity]': 'display,opacity',
    },
    colors: {
      sidebar: {
        DEFAULT: 'oklch(var(--sidebar))',
        background: 'oklch(var(--sidebar))',
        foreground: 'oklch(var(--sidebar-foreground))',
        primary: {
          DEFAULT: 'oklch(var(--sidebar-primary))',
          foreground: 'oklch(var(--sidebar-primary-foreground))',
        },
        accent: {
          DEFAULT: 'oklch(var(--sidebar-accent))',
          foreground: 'oklch(var(--sidebar-accent-foreground))',
        },
        border: 'oklch(var(--sidebar-border))',
        ring: 'oklch(var(--sidebar-ring))',
      },
    },
  },
  transformers: [
    transformerDirectives(),
    transformerVariantGroup(),
  ],
})
