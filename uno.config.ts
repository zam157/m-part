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
    [
      'btn',
      'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors cursor-default disabled:pointer-events-none disabled:opacity-50 outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] focus-visible:z-1 focus-visible:relative hover:bg-accent hover:text-accent-foreground dark:hover:bg-accent/50',
    ],
    [
      'btn-group',
      'flex items-center shrink-0 [&>*:not(:first-child)]:rounded-s-none [&>*:not(:first-child)]:border-s-0 [&>*:not(:last-child)]:rounded-e-none',
    ],
    [
      'border-btn',
      'inline-flex shrink-0 items-center justify-center rounded-lg border bg-clip-padding text-sm font-medium whitespace-nowrap transition-[border] outline-none select-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:z-1 focus-visible:relative disabled:pointer-events-none disabled:opacity-50 border-border bg-background hover:bg-muted hover:text-foreground dark:border-input dark:bg-input/30 dark:hover:bg-input/50',
    ],
    [
      'input',
      'w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1 text-base transition-colors outline-none file:inline-flex file:h-6 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:z-1 focus-visible:relative disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-input/50 disabled:opacity-50 md:text-sm dark:bg-input/30 dark:disabled:bg-input/80',
    ],
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
  outputToCssLayers: {
    allLayers: true,
  },
  layers: {
    fonts: 0,
    imports: 1,
    properties: 2,
    theme: 3,
    base: 4,
    preflights: 5,
    icons: 6,
    typography: 7,
    components: 8,
    shortcuts: 9,
    default: 10,
  },
})
