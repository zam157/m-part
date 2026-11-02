import { getCookieProviders } from '@m-part/music/provider-definitions'
import { For, Show } from 'solid-js'
import PlatformCookieForm from '~/components/PlatformCookieForm/PlatformCookieForm'
import { clientCookieStatus } from '~/composables/client-cookies'

export default function SettingsPage() {
  return (
    <div class="flex-1 min-w-0 overflow-auto px-9 py-8 max-[760px]:px-4.5 max-[760px]:py-6">
      <div class="max-w-3xl mx-auto space-y-5">
        <header><h1 class="page-title">音源设置</h1><p class="page-description">各平台独立设置。填写后优先使用手动 Cookie；清除后恢复对应网站的登录态。</p></header>
        <p class="text-sm text-muted-foreground leading-relaxed">Cookie 保存在当前客户端，不会修改网站 Cookie，也不会自动用于一起听托管。Web 形态的请求经本站服务转发。失效时请更新，或清除后恢复网站登录态。</p>
        <Show when={clientCookieStatus().error}><p class="text-sm text-destructive" role="alert">{clientCookieStatus().error}</p></Show>
        <For each={getCookieProviders()}>{provider => <PlatformCookieForm source={provider.name} config={provider.cookie} />}</For>
      </div>
    </div>
  )
}
