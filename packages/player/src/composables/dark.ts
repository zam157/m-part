import { createSignal } from 'solid-js'

export type ColorMode = 'light' | 'dark' | 'system'

const COLOR_MODE_KEY = 'mpart-color-mode'

function getStoredColorMode(): ColorMode {
  return (localStorage.getItem(COLOR_MODE_KEY) as ColorMode | null) ?? 'system'
}

const darkModeMediaQuery = window.matchMedia('(prefers-color-scheme: dark)')

const [colorMode, setColorMode] = createSignal<ColorMode>(getStoredColorMode())

export { colorMode }

darkModeMediaQuery.addEventListener('change', () => {
  if (getStoredColorMode() === 'system')
    document.documentElement.classList.toggle('dark', darkModeMediaQuery.matches)
})

export function switchColorMode(mode: ColorMode) {
  setColorMode(mode)
  localStorage.setItem(COLOR_MODE_KEY, mode)

  const preferDark = mode === 'dark' || (mode === 'system' && darkModeMediaQuery.matches)
  document.documentElement.classList.toggle('dark', preferDark)
}
