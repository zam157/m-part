import { useLocation, useNavigate } from '@solidjs/router'
import { clsx } from 'cn/lite'
import { For } from 'solid-js'
import { colorMode, switchColorMode } from '~/composables/dark'
import { playQueue, setShowPlayQueue, showPlayQueue } from '~/composables/player'
import './sidebar.css'

const menuItems = [
  { icon: 'i-lucide:house', label: '开始聆听', route: '/' },
  { icon: 'i-lucide:search', label: '搜索', route: '/search' },
]

export default function Sidebar() {
  const navigate = useNavigate()
  const location = useLocation()
  return (
    <aside class="app-sidebar bg-sidebar text-sidebar-foreground border-r border-sidebar-border">
      <button class="brand" aria-label="Music Party 首页" onClick={() => navigate('/')}>
        <span class="brand-mark bg-primary text-primary-foreground"><span class="i-lucide:audio-lines text-5" /></span>
        <span class="sidebar-label"><strong>Music Party</strong><small>让喜欢的声音，留在耳边。</small></span>
      </button>
      <div class="sidebar-section-label text-muted-foreground">音乐空间</div>
      <nav class="flex flex-col gap-1" aria-label="主导航">
        <For each={menuItems}>{item => (
          <button class={clsx('nav-item', location.pathname === item.route && 'nav-item-active bg-accent text-accent-foreground')} aria-current={location.pathname === item.route ? 'page' : undefined} title={item.label} onClick={() => navigate(item.route)}>
            <span class={clsx(item.icon, 'text-4')} /><span class="sidebar-label">{item.label}</span>
          </button>
        )}</For>
        <button class={clsx('nav-item', showPlayQueue() && 'bg-accent')} title="播放队列" onClick={() => setShowPlayQueue(!showPlayQueue())}>
          <span class="i-lucide:list-music text-4" /><span class="sidebar-label">播放队列</span><span class="sidebar-count text-muted-foreground">{playQueue().length}</span>
        </button>
      </nav>
      <div class="sidebar-source border border-border rounded-lg">
        <div class="flex items-center gap-2 text-sm font-medium"><span class="i-lucide:radio text-4" />Bilibili</div>
        <p class="text-xs text-muted-foreground mt-2">从视频里，发现喜欢的声音。</p>
      </div>
      <div class="sidebar-bottom border-t border-border">
        <button class="nav-item text-muted-foreground" title="切换主题" onClick={() => switchColorMode(colorMode() === 'dark' ? 'system' : colorMode() === 'system' ? 'light' : 'dark')}>
          <span class={clsx('text-4', colorMode() === 'dark' ? 'i-lucide:moon' : 'i-lucide:sun')} /><span class="sidebar-label">{colorMode() === 'dark' ? '深色外观' : colorMode() === 'system' ? '跟随系统' : '浅色外观'}</span>
        </button>
        <button class="nav-item text-muted-foreground" title="实验室" onClick={() => navigate('/playground')}><span class="i-lucide:flask-conical text-4" /><span class="sidebar-label">实验室</span></button>
      </div>
    </aside>
  )
}
