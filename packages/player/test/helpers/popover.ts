import { vi } from 'vitest'

/** jsdom has no top-layer implementation; model its beforetoggle lifecycle. */
export function mockPopover() {
  const matches = HTMLElement.prototype.matches
  vi.spyOn(HTMLElement.prototype, 'matches').mockImplementation(function (this: HTMLElement, selector) {
    return selector === ':popover-open' ? this.hasAttribute('data-test-open') : matches.call(this, selector)
  })
  function toggle(element: HTMLElement, state: 'open' | 'closed') {
    const event = new Event('beforetoggle')
    Object.defineProperty(event, 'newState', { value: state })
    element.dispatchEvent(event)
    element.toggleAttribute('data-test-open', state === 'open')
  }
  Object.defineProperty(HTMLElement.prototype, 'showPopover', { configurable: true, value(this: HTMLElement) { toggle(this, 'open') } })
  Object.defineProperty(HTMLElement.prototype, 'hidePopover', { configurable: true, value(this: HTMLElement) { toggle(this, 'closed') } })
  return () => {
    vi.restoreAllMocks()
    Reflect.deleteProperty(HTMLElement.prototype, 'showPopover')
    Reflect.deleteProperty(HTMLElement.prototype, 'hidePopover')
  }
}
