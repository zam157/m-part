export type ColorMode = 'light' | 'dark' | 'system'

const COLOR_MODE_KEY = 'mpart-color-mode'
export const colorMode = shallowRef<ColorMode>(localStorage.getItem(COLOR_MODE_KEY) as ColorMode || 'system')

;(() => {
  const darkModeMediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
  darkModeMediaQuery.addEventListener('change', () => {
    const prefersDark = darkModeMediaQuery.matches
    const setting = localStorage.getItem(COLOR_MODE_KEY) || 'system'
    if (setting === 'system') {
      document.documentElement.classList.toggle('dark', prefersDark)
    }
  })
})()

export function switchColorMode(mode: ColorMode) {
  colorMode.value = mode
  localStorage.setItem(COLOR_MODE_KEY, mode)
  if (mode === 'light' || (mode === 'system' && !window.matchMedia('(prefers-color-scheme: dark)').matches)) {
    document.documentElement.classList.toggle('dark', false)
  }
  else {
    document.documentElement.classList.toggle('dark', true)
  }
}
