/** jsdom has dialog elements but no native modal lifecycle. */
export function mockDialog() {
  const descriptors = new Map(['showModal', 'close'].map(key => [key, Object.getOwnPropertyDescriptor(HTMLDialogElement.prototype, key)]))
  Object.defineProperties(HTMLDialogElement.prototype, {
    showModal: { configurable: true, value(this: HTMLDialogElement) { this.open = true } },
    close: { configurable: true, value(this: HTMLDialogElement) { this.open = false; this.dispatchEvent(new Event('close')) } },
  })
  return () => {
    for (const [key, descriptor] of descriptors) {
      if (descriptor) Object.defineProperty(HTMLDialogElement.prototype, key, descriptor)
      else Reflect.deleteProperty(HTMLDialogElement.prototype, key)
    }
  }
}
