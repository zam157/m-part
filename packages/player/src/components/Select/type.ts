export interface Option<T = string> {
  label: string
  value: T
  disabled?: boolean
}
export interface GroupedOption<T = string> {
  label: string
  options: readonly Option<T>[]
}
export type SelectEntry<T> = Option<T> | GroupedOption<T>
