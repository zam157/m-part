import 'vue'

declare module 'vue' {
  interface HTMLAttributes {
    /**
     * - `auto` popovers can be "light dismissed" — this means that you can hide the popover by clicking outside it or pressing the `Esc` key. Showing an `auto` popover will generally close other `auto` popovers that are already displayed, unless they are nested.
     * - `hint` popovers do not close `auto` popovers when they are displayed, but will close other hint popovers. They can be light dismissed and will respond to close requests.
     * - `manual` popovers cannot be "light dismissed" and are not automatically closed. Popovers must explicitly be displayed and closed using declarative show/hide/toggle buttons or JavaScript. Multiple independent `manual` popovers can be shown simultaneously.
     */
    popover?: undefined | boolean | 'auto' | 'hint' | 'manual'
  }
}
