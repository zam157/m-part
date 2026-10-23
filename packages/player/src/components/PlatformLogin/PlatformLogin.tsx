import type { ProviderName } from '@m-part/music/types/provider'

export const platformOptions = [
  { value: 'bili', label: 'BiliBili', url: 'https://www.bilibili.com/' },
  { value: 'netease', label: '网易云', url: 'https://music.163.com/' },
  { value: 'qq', label: 'QQ音乐', url: 'https://y.qq.com/' },
] as const

export default function PlatformLogin(props: { source: ProviderName, onRefresh: () => void }) {
  const platform = () => platformOptions.find(item => item.value === props.source)!
  return (
    <div class="empty min-h-60">
      <span class="i-lucide:log-in text-8 text-muted-foreground" />
      <h2 class="text-lg font-semibold">登录后查看你的歌单</h2>
      <p class="text-sm text-muted-foreground">请在当前浏览器登录{platform().label}，然后刷新歌单。</p>
      <div class="flex gap-3 flex-wrap justify-center">
        <a class="btn" href={platform().url} target="_blank" rel="noopener noreferrer">前往{platform().label}</a>
        <button class="border-btn px-3 h-8" onClick={props.onRefresh}>我已登录，刷新</button>
      </div>
    </div>
  )
}
