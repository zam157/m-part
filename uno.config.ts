import { createLocalFontProcessor } from '@unocss/preset-web-fonts/local'
import {
  defineConfig,
  presetIcons,
  presetTypography,
  presetWebFonts,
  presetWind4,
  transformerDirectives,
  transformerVariantGroup,
} from 'unocss'
import { presetShadcn } from './shadcn'

export default defineConfig({
  shortcuts: [
    [
      'btn',
      'active:translate-y-px bg-clip-padding bg-primary border border-transparent disabled:opacity-50 disabled:cursor-not-allowed focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 font-medium gap-1.5 h-8 inline-flex items-center justify-center outline-none px-2.5 rounded-lg select-none shrink-0 text-primary-foreground text-sm transition-all whitespace-nowrap',
    ],
    [
      'ghost-btn',
      'inline-flex items-center justify-center gap-1.5 h-8 whitespace-nowrap rounded-lg text-sm font-medium transition-colors cursor-default disabled:opacity-50 outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] focus-visible:z-1 focus-visible:relative hover:[&:not(:disabled)]:bg-muted hover:[&:not(:disabled)]:text-foreground dark:hover:bg-accent/50',
    ],
    [
      'btn-group',
      'flex items-center shrink-0 [&>*:not(:first-child)]:rounded-s-none [&>*:not(:first-child)]:border-s-0 [&>*:not(:last-child)]:rounded-e-none',
    ],
    [
      'border-btn',
      'inline-flex shrink-0 items-center justify-center rounded-lg border bg-clip-padding text-sm font-medium whitespace-nowrap transition-[border] outline-none select-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:z-1 focus-visible:relative disabled:opacity-50 disabled:cursor-not-allowed border-border bg-background hover:[&:not(:disabled)]:bg-muted hover:[&:not(:disabled)]:text-foreground dark:border-input dark:bg-input/30 dark:hover:bg-input/50',
    ],
    [
      'input',
      'w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1 text-base transition-colors outline-none file:inline-flex file:h-6 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:z-1 focus-visible:relative disabled:cursor-not-allowed disabled:bg-input/50 disabled:opacity-50 md:text-sm dark:bg-input/30 dark:disabled:bg-input/80',
    ],
    [
      'input-group',
      'border-input dark:bg-input/30 relative flex w-full items-center rounded-lg border shadow-xs transition-[color,box-shadow] outline-none min-w-0 has-[>textarea]:h-auto has-[.input-group-control:focus-visible]:border-ring has-[.input-group-control:focus-visible]:ring-3 has-[.input-group-control:focus-visible]:ring-ring/50',
    ],
    [
      'input-group-control',
      'w-full min-w-0 border-input px-2.5 py-1 text-base transition-colors outline-none file:inline-flex file:h-6 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm flex-1 rounded-none border-0 bg-transparent shadow-none ring-0 focus-visible:ring-0 disabled:bg-transparent dark:bg-transparent dark:disabled:bg-transparent',
    ],
    [
      'input-group-addon',
      'flex h-auto cursor-text items-center justify-center gap-2 py-1.5 text-sm font-medium text-muted-foreground select-none [&>kbd]:rounded-[calc(var(--radius)-5px)] pr-2 has-[>button]:mr-[-0.3rem] has-[>kbd]:mr-[-0.15rem]',
    ],
    [
      'primary-content',
      'bg-primary text-primary-foreground',
    ],
    [
      'card',
      'flex flex-col gap-4 overflow-hidden rounded-xl bg-card py-4 text-sm text-card-foreground ring-1 ring-foreground/10 w-full max-w-sm',
    ],
    [
      'empty',
      'flex w-full min-w-0 flex-1 flex-col items-center justify-center gap-4 rounded-xl border-dashed p-6 text-center text-balance',
    ],
  ],
  presets: [
    presetWind4({
      reset: true,
    }),
    presetShadcn({
      color: 'neutral',
      radius: 0.625,
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
      processors: createLocalFontProcessor({
        cacheDir: 'node_modules/.cache/unocss/fonts',
        fontServeBaseUrl: '/assets/fonts',
        fontAssetsDir: 'public/assets/fonts',
      }),
    }),
  ],
  theme: {
    property: {
      'display': 'display',
      '[display,opacity]': 'display,opacity',
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
