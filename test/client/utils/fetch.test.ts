import { afterEach, describe, expect, it, vi } from 'vitest'

/**
 * 扩展形态下 `tRequest` 的传输策略。
 *
 * vitest 运行时 `import.meta.env.MODE` 是 `test`，拿不到扩展构建注入的
 * `VITE_TARGET`，因此这里直接 mock 掉常量模块把 `TARGET_EXTENSION` 打开。
 */
vi.mock('#shared/utils/constants', () => ({
  USE_PROXY: false,
  USE_GM_FETCH: false,
  TARGET_EXTENSION: true,
}))

// 必须在 vi.mock 之后再引入被测模块
const { tRequest } = await import('#shared/utils/fetch')

function jsonResponse(data: unknown = { code: 0 }) {
  return new Response(JSON.stringify(data), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  })
}

function stubFetch() {
  // 显式声明签名，否则 mock.calls 会被推断成空元组，取不到请求参数
  const fetchMock = vi.fn(async (_url: RequestInfo | URL, _init?: RequestInit) => jsonResponse())
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

function initOf(fetchMock: ReturnType<typeof stubFetch>): RequestInit {
  return fetchMock.mock.calls[0]![1]!
}

function urlOf(fetchMock: ReturnType<typeof stubFetch>): string {
  return String(fetchMock.mock.calls[0]![0])
}

describe('tRequest（扩展形态）', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('剥掉 fetch 设置不了的请求头，只保留自己传得动的', async () => {
    const fetchMock = stubFetch()

    await tRequest('https://api.bilibili.com/x/web-interface/view', {
      headers: {
        'cookie': 'SESSDATA=abc;',
        'referer': 'https://www.bilibili.com/video/BV1',
        'origin': 'https://www.bilibili.com',
        'user-agent': 'Mozilla/5.0',
        'accept-encoding': 'gzip, deflate, br',
        'accept': '*/*',
      },
    })

    const headers = initOf(fetchMock).headers as Headers
    expect([...headers.keys()].sort()).toEqual(['accept'])
  })

  it('默认使用 credentials: include，让浏览器带上真实登录凭据', async () => {
    const fetchMock = stubFetch()

    await tRequest('https://api.bilibili.com/x/web-interface/nav')

    expect(initOf(fetchMock).credentials).toBe('include')
  })

  it('调用方显式指定 credentials 时不覆盖', async () => {
    const fetchMock = stubFetch()

    await tRequest('https://api.bilibili.com/x/web-interface/nav', {
      credentials: 'omit',
    })

    expect(initOf(fetchMock).credentials).toBe('omit')
  })

  it('cookie 为空串时仍然使用 include（不再走匿名语义）', async () => {
    const fetchMock = stubFetch()

    await tRequest('https://api.bilibili.com/x/web-interface/view', {
      headers: { cookie: '', 'accept': '*/*' },
    })

    expect(initOf(fetchMock).credentials).toBe('include')
    expect([...(initOf(fetchMock).headers as Headers).keys()]).toEqual(['accept'])
  })

  it('保留 searchParams 拼接与 JSON 解析（不做代理用的 custom- 前缀改写）', async () => {
    const fetchMock = stubFetch()

    const [ok, data] = await tRequest<{ code: number }>('https://api.bilibili.com/x/player/wbi/playurl', {
      searchParams: { bvid: 'BV1', cid: 123 },
    })

    expect(urlOf(fetchMock)).toBe('https://api.bilibili.com/x/player/wbi/playurl?bvid=BV1&cid=123')
    expect(ok).toBe(true)
    expect(data).toEqual({ code: 0 })
  })
})
