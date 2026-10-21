import type { JSX } from '@solidjs/web'
import { Loading, Show } from 'solid-js'
import { playQueue } from './composables/player'
import MusicPlayer from './components/MusicPlayer/MusicPlayer'
import PlayQueue from './components/PlayQueue/PlayQueue'
import Sidebar from './components/Sidebar/Sidebar'
import ContextMenuHost from './components/ContextMenu/ContextMenuHost'

export interface AppProps {
  children?: JSX.Element
}

/**
 * 路由页面是代码分割的异步组件（`filesystem-routing` 生成的 `$component` 会被
 * `@solidjs/router/fs` 用 `lazy()` 包装），因此渲染路由出口会产生一次“异步读取”。
 *
 * `render()` 在初始挂载期间会启用 Loading 边界检查：如果没有边界接住这次读取，
 * 就会打印 `ASYNC_OUTSIDE_LOADING_BOUNDARY` 并把整棵根节点的挂载推迟到异步就绪。
 * 这里只在**内容区**加边界，外壳（侧边栏、播放列表、播放器）始终可见，
 * 等待路由模块加载时仅替换内容区，避免整屏闪烁。
 */
function PageLoading() {
  return (
    <div class="empty">
      <div class="text-muted-foreground i-lucide:loader-circle text-6 animate-spin" />
    </div>
  )
}

/**
 * 路由根布局（对应原 App.vue）。
 * 原来的 `<RouterView>` + `<KeepAlive :exclude>` 由 `Router` 的渲染函数子节点替代；
 * 保留页面状态的做法是把状态提升到模块作用域（见 `~/composables/search.ts`）。
 */
export default function App(props: AppProps) {
  return (
    <div
      class="
        h-100svh of-auto
        bg-background text-foreground selection:text-muted selection:bg-muted-foreground
        flex flex-col
      "
    >
      <main class="flex-1 min-h-0 flex">
        <Sidebar />
        <Loading fallback={<PageLoading />}>{props.children}</Loading>
        <PlayQueue />
      </main>
      <Show when={playQueue().length} fallback={(
        <footer class="h-21 shrink-0 border-t border-border flex items-center px-7 max-[760px]:px-4 gap-3.5 bg-background">
          <div class="size-12 border border-border rounded-[8px] grid place-items-center bg-muted text-muted-foreground"><span class="i-lucide:music-2 text-5" /></div>
          <div class="flex-1"><strong class="block text-[13px] font-medium">准备好，听点喜欢的。</strong><p class="text-[11px] mt-1.25 text-muted-foreground">搜索一首歌曲，开启你的播放队列。</p></div>
          <div class="flex gap-5.5 items-center text-muted-foreground opacity-45 mr-5 max-[760px]:gap-3 max-[760px]:mr-0" aria-hidden="true"><span class="i-lucide:skip-back text-4" /><span class="i-lucide:circle-play text-8" /><span class="i-lucide:skip-forward text-4" /></div>
        </footer>
      )}><MusicPlayer /></Show>
      <ContextMenuHost />
    </div>
  )
}
