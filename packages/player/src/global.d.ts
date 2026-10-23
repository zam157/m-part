declare global {
  interface Window {
    __tFetch?: typeof fetch
  }
}
