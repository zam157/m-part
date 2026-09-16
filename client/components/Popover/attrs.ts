/**
 * Popover 的属性合并工具。
 *
 * Solid 不会像 Vue 那样自动合并 `class` / `style`，组件需要自己把内置属性与用户
 * 透传的属性叠加起来，单独放在这里是为了能被单元测试直接覆盖。
 */

/**
 * 把 `style` 的两种写法（CSS 声明串 / 驼峰对象）统一序列化成声明串，便于叠加。
 *
 * 注意：不能直接 `{ ...defaultStyle }` 展开字符串（会得到 `{0:'a',1:'n',…}`），
 * 否则整条 style 会被浏览器丢弃，锚点定位等依赖内联样式的功能会静默失效。
 */
export function styleToCss(style: unknown): string {
  if (!style)
    return ''
  if (typeof style === 'string')
    return style
  return Object.entries(style as Record<string, unknown>)
    .map(([key, value]) => `${key.replace(/[A-Z]/g, m => `-${m.toLowerCase()}`)}:${value}`)
    .join(';')
}

/**
 * 合并 class / style 两个「可叠加」属性，其余属性原样透传。
 * 同名属性以用户传入的为准（内置声明在前，用户声明在后）。
 */
export function splitBoundAttrs(attrs: Record<string, any> | undefined, defaults: Record<string, any>) {
  const { class: className, style, ...rest } = attrs ?? {}
  const merged: Record<string, any> = { ...rest, ...defaults }

  if ('class' in defaults)
    merged.class = `${defaults.class} ${className ?? ''}`.trim()
  else if (className !== undefined)
    merged.class = className

  const defaultStyle = 'style' in defaults ? styleToCss(defaults.style) : ''
  const userStyle = styleToCss(style)
  if (defaultStyle || userStyle) {
    const separator = defaultStyle && !defaultStyle.trimEnd().endsWith(';') ? ';' : ''
    merged.style = `${defaultStyle}${separator}${userStyle}`
  }

  return merged
}
