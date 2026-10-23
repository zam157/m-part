export interface Option<T = any> {
  label: string
  value: T
  disabled?: boolean
}
export interface GroupedOption<T = any> {
  label: string
  options: Option<T>[]
}
