import 'vue'

declare module 'vue' {
  interface HTMLAttributes {
    popover?: string | boolean
  }
}
