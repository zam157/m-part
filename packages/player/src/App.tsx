import type { JSX } from '@solidjs/web'
import { Loading } from 'solid-js'
import MusicPlayer from './components/MusicPlayer/MusicPlayer'
import PlayQueue from './components/PlayQueue/PlayQueue'
import Sidebar from './components/Sidebar/Sidebar'
import ContextMenuHost from './components/ContextMenu/ContextMenuHost'
import ListenRoomBar from './components/ListenRoomBar/ListenRoomBar'
import TrackPartPicker from './components/TrackPartPicker/TrackPartPicker'

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
        flex flex-col [--player-height:88px] max-[760px]:[--player-height:128px]
      "
    >
      <main class="flex-1 min-h-0 flex">
        <Sidebar />
        <Loading fallback={<PageLoading />}>{props.children}</Loading>
        <PlayQueue />
      </main>
      <ListenRoomBar />
      <MusicPlayer />
      <ContextMenuHost />
      <TrackPartPicker />
    </div>
  )
}
