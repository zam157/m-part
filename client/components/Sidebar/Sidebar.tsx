import { useLocation, useNavigate } from '@solidjs/router'
import { clsx } from 'cn/lite'
import { createEffect, createSignal, For } from 'solid-js'
import { colorMode, switchColorMode } from '~/composables/dark'
import { playQueue, setShowPlayQueue, showPlayQueue } from '~/composables/player'
import Tooltip from '~/components/Tooltip/Tooltip'

const menuItems = [
  { icon: 'i-lucide:house', label: '首页', route: '/' },
  { icon: 'i-lucide:search', label: '搜索', route: '/search' },
  { icon: 'i-lucide:library', label: '我的歌单', route: '/playlists' },
]

export default function Sidebar() {
  const navigate = useNavigate()
  const location = useLocation()
  const compactQuery = window.matchMedia('(max-width: 760px)')
  const [collapsed, setCollapsed] = createSignal(compactQuery.matches)
  const isActive = (route: string) => location.pathname === route || location.pathname.startsWith('/playlist-detail/') && route === (new URLSearchParams(location.search).get('from') === 'search' ? '/search' : '/playlists')

  createEffect(() => compactQuery, (query) => {
    const handleResize = (event: MediaQueryListEvent) => setCollapsed(event.matches)
    query.addEventListener('change', handleResize)
    return () => query.removeEventListener('change', handleResize)
  })

  return (
    <aside
      class="group/sidebar w-58 shrink-0 flex flex-col p-4 overflow-hidden transition-[width,padding] duration-200 ease-[ease] data-[collapsed=true]:w-16 data-[collapsed=true]:px-2 motion-reduce:transition-none bg-sidebar text-sidebar-foreground border-r border-sidebar-border"
      data-collapsed={collapsed() ? 'true' : 'false'}
    >
      <button class="h-9 shrink-0 flex items-center gap-2.5 text-left px-1.5" aria-label="Music Party 首页" onClick={() => navigate('/')}>
        <span class="grid place-items-center size-9 rounded-[10px] shrink-0 bg-primary text-primary-foreground"><span class="i-lucide:audio-lines text-5" /></span>
        <span class="sidebar-label"><strong class="block text-[15px] leading-5 tracking-[-0.4px]">Music Party</strong></span>
      </button>
      <nav id="sidebar-navigation" class="mt-6 flex flex-col gap-1" aria-label="主导航">
        <For each={menuItems}>{item => (
          <Tooltip content={item.label} disabled={!collapsed()} placement="right">
            {triggerProps => (
              <button {...triggerProps} class={clsx('sidebar-item', isActive(item.route) && 'font-semibold bg-accent text-accent-foreground')} aria-current={isActive(item.route) ? 'page' : undefined} aria-label={item.label} onClick={() => navigate(item.route)}>
                <span class={clsx(item.icon, 'text-4 shrink-0')} /><span class="sidebar-label">{item.label}</span>
              </button>
            )}
          </Tooltip>
        )}</For>
        <Tooltip content="播放队列" disabled={!collapsed()} placement="right">
          {triggerProps => (
            <button {...triggerProps} class={clsx('sidebar-item', showPlayQueue() && 'bg-accent')} aria-label="播放队列" aria-controls="play-queue" aria-expanded={showPlayQueue() ? 'true' : 'false'} onClick={() => setShowPlayQueue(!showPlayQueue())}>
              <span class="i-lucide:list-music text-4 shrink-0" /><span class="sidebar-label">播放队列</span><span class="ml-auto text-[11px] tabular-nums text-muted-foreground group-data-[collapsed=true]/sidebar:hidden">{playQueue().length}</span>
            </button>
          )}
        </Tooltip>
      </nav>
      <div class="mt-auto pt-3.5 border-t border-border">
        <Tooltip content="切换主题" disabled={!collapsed()} placement="right">
          {triggerProps => (
            <button {...triggerProps} class="sidebar-item text-muted-foreground" aria-label="切换主题" onClick={() => switchColorMode(colorMode() === 'dark' ? 'system' : colorMode() === 'system' ? 'light' : 'dark')}>
              <span class={clsx('text-4 shrink-0', colorMode() === 'dark' ? 'i-lucide:moon' : colorMode() === 'system' ? 'i-lucide:monitor' : 'i-lucide:sun')} /><span class="sidebar-label">{colorMode() === 'dark' ? '深色外观' : colorMode() === 'system' ? '跟随系统' : '浅色外观'}</span>
            </button>
          )}
        </Tooltip>
        <Tooltip content={collapsed() ? '展开侧栏' : '收起侧栏'} disabled={!collapsed()} placement="right">
          {triggerProps => (
            <button
              {...triggerProps}
              class="sidebar-item text-muted-foreground"
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
            <button {...triggerProps} class="sidebar-item text-muted-foreground" aria-label="实验室" onClick={() => navigate('/playground')}><span class="i-lucide:flask-conical text-4 shrink-0" /><span class="sidebar-label">实验室</span></button>
          )}
        </Tooltip>
      </div>
    </aside>
  )
}
