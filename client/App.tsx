import type { JSX } from '@solidjs/web'
import MusicPlayer from './components/MusicPlayer/MusicPlayer'
import Playlist from './components/Playlist/Playlist'
import Sidebar from './components/Sidebar/Sidebar'

export interface AppProps {
  children?: JSX.Element
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
        {props.children}
        <Playlist />
      </main>
      <MusicPlayer />
    </div>
  )
}
