import type { ProviderName } from '@m-part/music/types/provider'
import { clsx } from 'cn/lite'
import { createEffect, For, Match, Show, Switch } from 'solid-js'
import ErrorMessage from '~/components/ErrorMessage/ErrorMessage'
import MusicContextMenu from '~/components/MusicContextMenu/MusicContextMenu'
import { addToPlayQueue } from '~/composables/player'
import { loadRecommendations, recommendations } from '~/composables/recommendations'

interface RecommendationsProps {
  source: ProviderName
  title: string
  description: string
}

const gridClass = 'grid grid-cols-[repeat(auto-fill,minmax(min(100%,clamp(320px,20vw,420px)),1fr))] gap-4 max-[760px]:grid-cols-1'

export default function Recommendations(props: RecommendationsProps) {
  const state = () => recommendations()[props.source]
  createEffect(() => props.source, source => { void loadRecommendations(source) })

  return (
    <section class="mt-8.5" aria-label={props.title} aria-busy={state().loading ? 'true' : 'false'}>
      <div class="flex items-center justify-between gap-4 mb-4.5">
        <div class="min-w-0"><h2 class="text-[19px] font-semibold tracking-[-0.5px]">{props.title}</h2><p class="page-description">{props.description}</p></div>
        <button class="ghost-btn px-3" disabled={state().loading} onClick={() => loadRecommendations(props.source, true)} aria-label={`刷新${props.title}`}>
          <span class={clsx('i-lucide:refresh-cw text-4', state().loading && 'animate-spin motion-reduce:animate-none')} />刷新
        </button>
      </div>
      <Show when={state().loaded && state().error}>
        <p role="alert" class="mb-4 text-sm text-destructive">刷新失败：{state().error}，已保留上次结果，请重试。</p>
      </Show>
      <Switch>
        <Match when={state().error && !state().loaded}>
          <ErrorMessage message={state().error ?? ''} onRetry={() => loadRecommendations(props.source, true)} />
        </Match>
        <Match when={!state().loaded}>
          <div class={gridClass} role="status" aria-label={`正在加载${props.title}`}>
            <For each={[0, 1, 2, 3]}>{() => <div class="skeleton h-42" />}</For>
          </div>
        </Match>
        <Match when={state().items.length}>
          <div class={gridClass}>
            <For each={state().items}>{music => (
              <MusicContextMenu music={music}>{trigger => (
                <button {...trigger} class="card p-2 gap-2 text-left hover:bg-muted transition-colors focus-visible:outline-ring" onClick={() => addToPlayQueue(music)} aria-label={`播放 ${music.title}`}>
                  <img src={music.coverUrl} alt="" loading="lazy" referrerpolicy="no-referrer" class="w-full aspect-ratio-video object-cover rounded-md" />
                  <span class="text-sm/relaxed font-semibold line-clamp-2 min-h-10">{music.title}</span>
                  <span class="text-xs text-muted-foreground truncate w-full">{music.artist}</span>
                </button>
              )}</MusicContextMenu>
            )}</For>
          </div>
        </Match>
        <Match when={state().loaded}>
          <div class="empty text-sm text-muted-foreground">暂时没有推荐内容</div>
        </Match>
      </Switch>
    </section>
  )
}
