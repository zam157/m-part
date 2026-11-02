import type { ProviderName } from '@m-part/music/types/provider'
import { useNavigate } from '@solidjs/router'
import { clientCookieStatus } from '~/composables/client-cookies'

export const platformOptions = [
  { value: 'bili', label: 'BiliBili', url: 'https://www.bilibili.com/' },
  { value: 'netease', label: '网易云', url: 'https://music.163.com/' },
  { value: 'qq', label: 'QQ音乐', url: 'https://y.qq.com/' },
] as const

export default function PlatformLogin(props: { source: ProviderName, onRefresh: () => void }) {
  const navigate = useNavigate()
  const platform = () => platformOptions.find(item => item.value === props.source)!
  return (
    <div class="empty min-h-60">
      <span class="i-lucide:log-in text-8 text-muted-foreground" />
      <h2 class="text-lg font-semibold">登录后查看你的歌单</h2>
      <p class="text-sm text-muted-foreground">{clientCookieStatus().configured[props.source] ? '当前手动 Cookie 可能已失效，请在音源设置中更新，或恢复网站 Cookie 后刷新歌单。' : `请在当前浏览器登录${platform().label}，然后刷新歌单。`}</p>
      <div class="flex gap-3 flex-wrap justify-center">
        <a class="btn" href={platform().url} target="_blank" rel="noopener noreferrer">前往{platform().label}</a>
        <button class="border-btn px-3 h-8" onClick={props.onRefresh}>我已登录，刷新</button>
        <button class="border-btn px-3 h-8" onClick={() => navigate('/settings')}>填写 Cookie</button>
      </div>
    </div>
  )
}
