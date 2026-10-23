import { describe, expect, it } from 'vitest'
import { toHttpsUrl } from '../src/utils/url'

describe('toHttpsUrl', () => {
  it('把 http 图片地址升级为 https', () => {
    expect(toHttpsUrl('http://i2.hdslb.com/bfs/archive/a.jpg'))
      .toBe('https://i2.hdslb.com/bfs/archive/a.jpg')
  })

  it('把协议相对地址补全为 https 绝对地址', () => {
    expect(toHttpsUrl('//i2.hdslb.com/bfs/archive/a.jpg'))
      .toBe('https://i2.hdslb.com/bfs/archive/a.jpg')
  })

  it('大小写不同的协议也照样升级', () => {
    expect(toHttpsUrl('HTTP://i2.hdslb.com/a.jpg')).toBe('https://i2.hdslb.com/a.jpg')
  })

  it('已经是 https 的地址保持不变', () => {
    expect(toHttpsUrl('https://i2.hdslb.com/bfs/archive/a.jpg'))
      .toBe('https://i2.hdslb.com/bfs/archive/a.jpg')
  })

  it('空值返回空串', () => {
    expect(toHttpsUrl()).toBe('')
    expect(toHttpsUrl('')).toBe('')
  })
})
