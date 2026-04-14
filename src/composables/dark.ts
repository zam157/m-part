const colorMode = useColorMode()

export function switchColorMode(mode: typeof colorMode.value) {
  colorMode.value = mode
}
