/** 从 catch 到的任意值里取出可展示的文案：抛出来的不一定是 Error */
export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}
