import { getCookieProviders } from '@m-part/music/provider-definitions'
import { checkWebExtension } from '@m-part/music/web-bridge'
import { getWebTransport, setWebTransport, usesWebTransport } from '@m-part/music/web-transport'
import type { WebTransport } from '@m-part/music/web-transport'
import { createSignal, For, Show } from 'solid-js'
import Dialog, { DialogBody, DialogHeader } from '~/components/Dialog/Dialog'
import PlatformCookieForm from '~/components/PlatformCookieForm/PlatformCookieForm'
import Select from '~/components/Select/Select'
import { clientCookieStatus } from '~/composables/client-cookies'
import { colorMode, switchColorMode } from '~/composables/dark'
import { errorMessage } from '~/utils/index'

const colorModes = [
  { value: 'system', label: '跟随系统' },
  { value: 'light', label: '浅色' },
  { value: 'dark', label: '深色' },
] as const

const webModes = [
  { value: 'proxy', label: '代理服务' },
  { value: 'extension', label: '浏览器扩展' },
] as const

function WebTransportSettings(props: { mode: WebTransport }) {
  const [mode, setMode] = createSignal(props.mode)
  const [busy, setBusy] = createSignal(false)
  const [message, setMessage] = createSignal('')
  const [error, setError] = createSignal('')

  async function check() {
    if (busy()) return
    const selected = mode()
    setBusy(true); setMessage(''); setError('')
    try {
      if (selected === 'extension') await checkWebExtension()
      else {
        const response = await fetch('/api/provider-request', { credentials: 'omit', cache: 'no-store', signal: AbortSignal.timeout(5000) })
        if (!response.ok || !response.headers.get('content-type')?.includes('application/json') || (await response.json()).version !== 1)
          throw new Error('本站代理服务不可用，请检查 Web 服务是否已启动')
      }
      if (selected !== props.mode) {
        setWebTransport(selected)
        window.location.reload()
      }
      else setMessage(selected === 'extension' ? '已连接 m-part 扩展。' : '已连接本站代理服务。')
    }
    catch (cause) { setError(errorMessage(cause)) }
    finally { setBusy(false) }
  }

  return (
    <section class="rounded-xl border border-border p-5 grid gap-4" aria-labelledby="web-transport-title">
      <h2 id="web-transport-title" class="text-base font-semibold">网页取源</h2>
      <div class="grid gap-3">
        <span id="web-transport-label" class="text-sm">取源方式</span>
        <Select aria-labelledby="web-transport-label" options={webModes} value={mode()} disabled={busy()} triggerClass="w-full" onValueChange={next => { setMode(next); setMessage(''); setError('') }} />
        <p class="text-sm text-muted-foreground">
          {mode() === 'extension'
            ? '通过已安装的 m-part 扩展请求音源，可使用网站登录态或下方设置的手动 Cookie。'
            : '通过本站服务请求接口和音频。可匿名取源，也可使用下方保存的手动 Cookie。'}
        </p>
        <Show when={mode() !== props.mode}>
          <p class="text-sm text-muted-foreground">保存后会重新加载页面，当前播放会暂停。</p>
        </Show>
      </div>
      <div class="flex">
        <button type="button" class="btn px-3" disabled={busy()} onClick={() => void check()}>{busy() ? '连接中…' : mode() === props.mode ? '测试连接' : '保存'}</button>
      </div>
      <Show when={error()}><p class="text-sm text-destructive" role="alert">{error()}</p></Show>
      <Show when={message()}><p class="text-sm text-muted-foreground" role="status">{message()}</p></Show>
    </section>
  )
}

export default function SettingsPage() {
  const web = usesWebTransport()
  const transport = web ? getWebTransport() : 'extension'
  const anonymous = web && transport === 'proxy'
  const providers = getCookieProviders()
  const [editingAccount, setEditingAccount] = createSignal<(typeof providers)[number]>()
  const closeAccount = () => setEditingAccount(undefined)

  return (
    <div class="flex-1 min-w-0 overflow-auto px-9 py-8 max-[760px]:px-4.5 max-[760px]:py-6">
      <div class="flex justify-center">
        <div class="w-full max-w-3xl grid gap-5">
          <header class="grid gap-[7px]"><h1 class="page-title">设置</h1><p class="page-description">管理外观、取源方式和音源账号。</p></header>
          <section class="rounded-xl border border-border p-5 grid gap-4" aria-labelledby="appearance-title">
            <h2 id="appearance-title" class="text-base font-semibold">外观</h2>
            <div class="grid gap-3">
              <span id="theme-label" class="text-sm">主题</span>
              <Select aria-labelledby="theme-label" options={colorModes} value={colorMode()} triggerClass="w-full" onValueChange={switchColorMode} />
            </div>
          </section>
          <Show when={web}><WebTransportSettings mode={transport} /></Show>
          <section class="grid gap-4" aria-labelledby="source-settings-title">
            <div class="grid gap-3">
              <h2 id="source-settings-title" class="text-base font-semibold">音源账号</h2>
              <p class="text-sm text-muted-foreground leading-relaxed">
                {anonymous
                  ? '手动 Cookie 保存在当前浏览器，取源时由本站服务转发。匿名取源使用平台的访客会话。'
                  : '各平台独立选择手动 Cookie 或网站 Cookie。切换来源会保留已保存的值，只有「清除」会删除手动 Cookie。'}
              </p>
              <p class="text-sm text-muted-foreground">作为一起听房主时，跟随音源设置的平台会将当前可用会话用于服务器托管。</p>
            </div>
            <Show when={clientCookieStatus().error}><p class="text-sm text-destructive" role="alert">{clientCookieStatus().error}</p></Show>
            <ul class="divide-y divide-border rounded-xl border border-border" aria-label="各平台音源账号">
              <For each={providers}>{provider => (
                <li class="flex items-center justify-between gap-3 px-4 py-3">
                  <div class="min-w-0 grid gap-1">
                    <span class="text-sm font-medium">{provider.cookie.label}</span>
                    <span class="text-xs text-muted-foreground">{clientCookieStatus().modes[provider.name] === 'manual' ? '手动 Cookie' : anonymous ? '匿名取源' : '网站 Cookie'}</span>
                  </div>
                  <button type="button" class="border-btn h-8 px-3" aria-haspopup="dialog" aria-label={`设置${provider.cookie.label}账号`} onClick={() => setEditingAccount(provider)}>修改</button>
                </li>
              )}</For>
            </ul>
            <Dialog open={!!editingAccount()} aria-labelledby="source-account-title" onClose={closeAccount}>
              <Show when={editingAccount()} keyed>{provider => (
                <>
                  <DialogHeader title={`${provider.cookie.label}账号`} titleId="source-account-title" onClose={closeAccount} />
                  <DialogBody><PlatformCookieForm source={provider.name} config={provider.cookie} anonymous={anonymous} /></DialogBody>
                </>
              )}</Show>
            </Dialog>
          </section>
        </div>
      </div>
    </div>
  )
}
