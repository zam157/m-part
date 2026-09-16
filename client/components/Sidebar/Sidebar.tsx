import { useLocation, useNavigate } from '@solidjs/router'
import { For } from 'solid-js'

const menuItems = [
  {
    icon: 'i-solar:magnifer-linear',
    label: 'Search',
    route: '/search',
  },
  {
    icon: 'i-solar:lightbulb-bolt-linear',
    label: 'Playground',
    route: '/playground',
  },
]

export default function Sidebar() {
  const navigate = useNavigate()
  const location = useLocation()

  const isActive = (route: string) => location.pathname === route

  function itemClass(route: string) {
    return isActive(route) ? 'bg-accent text-accent-foreground' : ''
  }

  return (
    <div
      class="
        w-54 flex flex-col of-hidden
        gap-0.5 bg-sidebar text-sidebar-foreground grow-0 shrink-0
        border-r border-sidebar-border
      "
    >
      <div class="flex flex-col gap-1 p-2">
        <div
          class={`ghost-btn flex w-full items-center gap-2 p-2 text-left h-12 text-sm ${itemClass('/')}`.trim()}
          onClick={() => navigate('/')}
        >
          <div class="i-solar:music-library-2-bold flex aspect-square text-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground" />
          <div class="w-full truncate font-semibold">
            Music Party
          </div>
        </div>
        <For each={menuItems}>
          {item => (
            <div class="flex min-h-0 flex-1 flex-col gap-2 overflow-auto">
              <div
                class={`ghost-btn w-full p-2 flex justify-start gap-2 ${itemClass(item.route)}`.trim()}
                onClick={() => navigate(item.route)}
              >
                <div class={`grow-0 shrink-0 ${item.icon}`} />
                <span class="flex-1 truncate">{item.label}</span>
              </div>
            </div>
          )}
        </For>
      </div>
    </div>
  )
}
