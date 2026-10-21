import type { MusicInfo } from '#shared/types/music-info'
import type { ProviderName } from '#shared/types/provider'
import { errorMessage } from '#shared/utils'
import { providers } from '#shared/utils/providers/index'
import { createSignal, untrack } from 'solid-js'

interface RecommendationState {
  items: MusicInfo[]
  loading: boolean
  loaded: boolean
  error: string | null
}

function emptyState(): RecommendationState {
  return { items: [], loading: false, loaded: false, error: null }
}

// 离开首页再返回时复用结果；两个音源独立加载和重试。
const [recommendations, setRecommendations] = createSignal<Record<ProviderName, RecommendationState>>({
  bili: emptyState(),
  netease: emptyState(),
})

export { recommendations }

const pending: Partial<Record<ProviderName, Promise<void>>> = {}

export function loadRecommendations(source: ProviderName, refresh = false): Promise<void> {
  if (pending[source])
    return pending[source]
  // 只读缓存快照，不把缓存变化变成组件 effect 的依赖。
  if (!refresh && untrack(() => recommendations()[source].loaded))
    return Promise.resolve()

  const request = (async () => {
    // 允许组件初次挂载时调用，避免在 Solid 2 的渲染作用域中写入信号。
    await Promise.resolve()
    setRecommendations(state => ({ ...state, [source]: { ...state[source], loading: true, error: null } }))
    try {
      const provider = providers[source]
      if (!provider.getRecommendations)
        throw new Error('该音源暂不支持推荐内容')
      const items = await provider.getRecommendations()
      setRecommendations(state => ({ ...state, [source]: { items, loading: false, loaded: true, error: null } }))
    }
    catch (error) {
      setRecommendations(state => ({ ...state, [source]: { ...state[source], loading: false, error: errorMessage(error) } }))
    }
    finally {
      delete pending[source]
    }
  })()
  pending[source] = request
  return request
}
