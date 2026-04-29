# Copilot Instructions for m-part

## Project Overview

m-part is a full-stack Vue 3 application for music playback and playlist management. It uses Vite for the frontend build and Nitro for backend APIs.

## Architecture

- **Frontend**: Vue 3 + Vite in `client/` directory
  - File-based routing via `client/pages/`
  - Components in `client/components/`
  - Composables in `client/composables/`
  - Styling with UnoCSS + tailwind presets
  - Auto-imports enabled for Vue, vue-i18n, @vueuse/core, and vue-router

- **Backend**: Nitro (serverless framework) in `server/` directory
  - API routes in `server/api/`
  - Middleware in `server/middleware/`

- **State Management**: Pinia is not being used; instead, we rely on Vue's built-in reactivity and composables for state management.
- **Routing**: Vue Router 5 with auto-imports
- **Internationalization**: Vue I18n with YAML locale files in `locales/`
- **Testing**: Vitest with separate client/server test projects
- **Styling**: UnoCSS with shadcn preset (neutral color), typography, web fonts (DM Sans, DM Serif Display, Roboto Mono)

## Build & Development Commands

```bash
pnpm dev              # Dev server on port 3333
pnpm build            # Production build (vite-ssg for SSG)
pnpm preview          # Preview production build locally
pnpm preview-https    # Preview with serve (HTTPS)

pnpm test             # Run all tests (vitest)
pnpm test client      # Run only client tests
pnpm test server      # Run only server tests
pnpm test -- --ui     # Run with UI dashboard

pnpm lint             # Run ESLint with fixes
pnpm typecheck        # Full type checking (frontend + backend + node)
pnpm typecheck:frontend  # Frontend types only
pnpm typecheck:backend   # Backend types only
```

## Key Conventions

### ESLint & Code Style

Uses `@antfu/eslint-config` with these custom rules:

- Vue attributes and events use **no-hyphenation style** (e.g., `@click` not `@click`, `myProp` not `my-prop`)
- UnoCSS validation enabled
- Formatters enabled for multiple file types
- Auto-fixed on pre-commit via `nano-staged`

### Vue Components

- Components auto-import has been disabled, so import components manually for better clarity and control.
- Use `<script setup>` with TypeScript
- Composables from `client/composables/` are auto-imported (when configured)
- Access to Vue, vue-i18n, @vueuse/core, and vue-router via auto-imports

### Styling

- Use UnoCSS utility classes (no CSS files needed for most cases)
- Tailwind 4 presets available via `presetWind4`
- shadcn preset with neutral color for consistent theming
- Custom shortcuts defined in `uno.config.ts` (e.g., `btn` class)
- Icons from Iconify via UnoCSS icon preset

### i18n

- Translation files in `locales/` as YAML
- Filename becomes locale code (e.g., `en.yaml` → `en` locale)
- Loaded automatically; no manual registration needed
- Use `useI18n()` composable to access translations

### File-Based Routing

- Pages in `client/pages/` automatically become routes
- Use `[...all].vue` for catch-all routes
- Typed route objects via `typed-router.d.ts` (generated automatically)

### Testing Setup

Vitest configured with two separate projects:

- **server**: Node environment for backend tests (`test/server/**/*.test.ts`)
- **client**: jsdom environment for component tests (`test/client/**/*.test.ts`)

## TypeScript

Three separate tsconfig files manage different scopes:

- `tsconfig.frontend.json`: Client-side code only
- `tsconfig.backend.json`: Server-side code only
- `tsconfig.node.json`: Build and config files

Run type-checking for the scope you're working in to get accurate diagnostics.

## Dependency Management

Uses pnpm workspaces with catalog mode (`pnpm-workspace.yaml`). Dependency versions are managed in catalogs by scope (backend, build, dev, frontend) rather than direct version specs in `package.json`.

## Notes

- `.editorconfig` is used to enforce consistent editor settings
- Simple git hooks configured: pre-commit runs `nano-staged` for eslint auto-fix
- Nitro configured to use static HTML template rendering from `index.html`
