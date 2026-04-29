import { describe, expect, it } from 'vitest'

describe('hello api', () => {
  it('should return method and params', async () => {
    const res = await fetch('http://localhost:3333/api/hello?foo=bar', {
      method: 'POST',
      body: JSON.stringify({ baz: 'qux' }),
    }).then(res => res.json())
    expect(res).toEqual({
      method: 'POST',
      queries: { foo: 'bar' },
      body: { baz: 'qux' },
    })
  })
})
