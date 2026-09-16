import { describe, expect, it } from 'vitest'
import { splitBoundAttrs, styleToCss } from '~/components/Popover/attrs'

describe('styleToCss', () => {
  it('空值返回空串', () => {
    expect(styleToCss(undefined)).toBe('')
    expect(styleToCss(null)).toBe('')
    expect(styleToCss('')).toBe('')
  })

  it('原样返回声明串', () => {
    expect(styleToCss('anchor-name:--x;')).toBe('anchor-name:--x;')
  })

  it('把驼峰对象转成 kebab-case 声明串', () => {
    expect(styleToCss({ positionAnchor: '--x', justifySelf: 'anchor-center' }))
      .toBe('position-anchor:--x;justify-self:anchor-center')
  })

  it('保留自定义属性名（-- 开头）', () => {
    expect(styleToCss({ '--volume-percent': '50%' })).toBe('--volume-percent:50%')
  })
})

describe('splitBoundAttrs', () => {
  it('没有用户属性时保留内置 style（锚点定位依赖它）', () => {
    const merged = splitBoundAttrs(undefined, {
      class: 't-popover-trigger',
      style: 'anchor-name:--x;',
    })
    expect(merged.class).toBe('t-popover-trigger')
    expect(merged.style).toBe('anchor-name:--x;')
  })

  it('叠加用户传入的声明串 style', () => {
    const merged = splitBoundAttrs({ style: 'color:red' }, { style: 'anchor-name:--x;' })
    expect(merged.style).toBe('anchor-name:--x;color:red')
  })

  it('叠加用户传入的对象 style，并让用户声明在后覆盖内置声明', () => {
    const merged = splitBoundAttrs(
      { style: { top: 'anchor(bottom)', left: 'auto' } },
      { style: 'position-anchor:--x;top:auto;' },
    )
    expect(merged.style).toBe('position-anchor:--x;top:auto;top:anchor(bottom);left:auto')
  })

  it('没有内置 style 时直接使用用户 style', () => {
    expect(splitBoundAttrs({ style: 'color:red' }, {}).style).toBe('color:red')
    expect(splitBoundAttrs(undefined, {}).style).toBeUndefined()
  })

  it('合并 class 并透传其余属性', () => {
    const merged = splitBoundAttrs(
      { class: 'extra', popovertarget: 'p1', 'data-test': 'x' },
      { class: 'base', id: 'p1' },
    )
    expect(merged.class).toBe('base extra')
    expect(merged.id).toBe('p1')
    expect(merged.popovertarget).toBe('p1')
    expect(merged['data-test']).toBe('x')
  })

  it('内置没有 class 时沿用用户 class', () => {
    expect(splitBoundAttrs({ class: 'only' }, {}).class).toBe('only')
  })
})
