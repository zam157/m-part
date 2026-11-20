import { expect, it } from 'vitest'

it('serves the same loadable app entry for the home page and a deep link', async () => {
  const base = process.env.WEB_TEST_BASE_URL ?? 'http://127.0.0.1:3411'
  const entries = await Promise.all(['/', '/settings'].map(async (route) => {
    const response = await fetch(new URL(route, base), { headers: { accept: 'text/html' } })
    expect(response.status).toBe(200)
    const html = await response.text()
    return [...html.matchAll(/<script type="module"[^>]*\bsrc="([^"]+)"/g)].map(match => match[1]!)
  }))

  const [home, settings] = entries
  expect(home?.length).toBeGreaterThan(0)
  expect(home).toEqual(settings)
  for (const entry of home!) {
    const response = await fetch(new URL(entry, base))
    expect(response.status, entry).toBe(200)
    expect(response.headers.get('content-type'), entry).toMatch(/javascript/)
    await response.body?.cancel()
  }
})
