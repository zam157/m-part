import { useLocation, useNavigate } from '@solidjs/router'
import { clsx } from 'cn/lite'
import { createEffect, createSignal, For } from 'solid-js'
import { colorMode, switchColorMode } from '~/composables/dark'
import { playQueue, setShowPlayQueue, showPlayQueue } from '~/composables/player'
import Tooltip from '~/components/Tooltip/Tooltip'
import './sidebar.css'

const menuItems = [
  { icon: 'i-lucide:house', label: '开始聆听', route: '/' },
  { icon: 'i-lucide:search', label: '搜索', route: '/search' },
]

export default function Sidebar() {
  const navigate = useNavigate()
  const location = useLocation()
  const compactQuery = window.matchMedia('(max-width: 760px)')
  const [collapsed, setCollapsed] = createSignal(compactQuery.matches)

  createEffect(() => compactQuery, (query) => {
    const handleResize = (event: MediaQueryListEvent) => setCollapsed(event.matches)
    query.addEventListener('change', handleResize)
    return () => query.removeEventListener('change', handleResize)
  })

  return (
    <aside
      class="app-sidebar bg-sidebar text-sidebar-foreground border-r border-sidebar-border"
      data-collapsed={collapsed() ? 'true' : 'false'}
    >
      <button class="brand" aria-label="Music Party 首页" onClick={() => navigate('/')}>
        <span class="brand-mark bg-primary text-primary-foreground"><span class="i-lucide:audio-lines text-5" /></span>
        <span class="sidebar-label"><strong>Music Party</strong><small>让喜欢的声音，留在耳边。</small></span>
      </button>
      <nav id="sidebar-navigation" class="sidebar-navigation flex flex-col gap-1" aria-label="主导航">
        <For each={menuItems}>{item => (
          <Tooltip content={item.label} disabled={!collapsed()} placement="right">
            {triggerProps => (
              <button {...triggerProps} class={clsx('nav-item', location.pathname === item.route && 'nav-item-active bg-accent text-accent-foreground')} aria-current={location.pathname === item.route ? 'page' : undefined} aria-label={item.label} onClick={() => navigate(item.route)}>
                <span class={clsx(item.icon, 'text-4')} /><span class="sidebar-label">{item.label}</span>
              </button>
            )}
          </Tooltip>
        )}</For>
        <Tooltip content="播放队列" disabled={!collapsed()} placement="right">
          {triggerProps => (
            <button {...triggerProps} class={clsx('nav-item', showPlayQueue() && 'bg-accent')} aria-label="播放队列" onClick={() => setShowPlayQueue(!showPlayQueue())}>
              <span class="i-lucide:list-music text-4" /><span class="sidebar-label">播放队列</span><span class="sidebar-count text-muted-foreground">{playQueue().length}</span>
            </button>
          )}
        </Tooltip>
      </nav>
      <div class="sidebar-bottom border-t border-border">
        <Tooltip content="切换主题" disabled={!collapsed()} placement="right">
          {triggerProps => (
            <button {...triggerProps} class="nav-item text-muted-foreground" aria-label="切换主题" onClick={() => switchColorMode(colorMode() === 'dark' ? 'system' : colorMode() === 'system' ? 'light' : 'dark')}>
              <span class={clsx('text-4', colorMode() === 'dark' ? 'i-lucide:moon' : colorMode() === 'system' ? 'i-lucide:monitor' : 'i-lucide:sun')} /><span class="sidebar-label">{colorMode() === 'dark' ? '深色外观' : colorMode() === 'system' ? '跟随系统' : '浅色外观'}</span>
            </button>
          )}
        </Tooltip>
        <Tooltip content={collapsed() ? '展开侧栏' : '收起侧栏'} disabled={!collapsed()} placement="right">
          {triggerProps => (
            <button
              {...triggerProps}
              class="nav-item sidebar-toggle text-muted-foreground"
              aria-label={collapsed() ? '展开侧栏' : '收起侧栏'}
              aria-expanded={collapsed() ? 'false' : 'true'}
              aria-controls="sidebar-navigation"

             onClick={() => setCollapsed(value => !value)}
            >
              <span class={clsx('text-4 shrink-0', collapsed() ? 'i-lucide:panel-left-open' : 'i-lucide:panel-left-close')} />
              <span class="sidebar-label">收起侧栏</span>
            </button>
          )}
        </Tooltip>
        <Tooltip content="实验室" disabled={!collapsed()} placement="right">
          {triggerProps => (
            <button {...triggerProps} class="nav-item text-muted-foreground" aria-label="实验室" onClick={() => navigate('/playground')}><span class="i-lucide:flask-conical text-4" /><span class="sidebar-label">实验室</span></button>
          )}
        </Tooltip>
      </div>
    </aside>
  )
}
