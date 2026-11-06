import type { HostedPlatform } from '@m-part/listen-core/protocol'
import { hostedPlatform } from '@m-part/listen-core/protocol'
import { useNavigate } from '@solidjs/router'
import { getWebTransport, usesWebTransport } from '@m-part/music/web-transport'
import { clientCookieStatus } from '~/composables/client-cookies'
import { roomCredentialProviders } from '~/utils/room-credentials'
import { createEffect, createSignal, For, Show } from 'solid-js'
import { clsx } from 'cn/lite'
import Dialog, { DialogBody, DialogHeader } from '~/components/Dialog/Dialog'
import { manageRoomSource, roomView, usePersonalRoomSource, syncRoomCredentials } from '~/composables/listen-room'

/** Room credentials follow the host's active Provider session settings. */
export default function ListenRoomSources() {
  const navigate = useNavigate()
  const platforms = roomCredentialProviders.map(item => ({ id: item.name, name: item.cookie.label, placeholder: item.cookie.placeholder }))
  const [platform, setPlatform] = createSignal<HostedPlatform>(platforms[0]?.id ?? hostedPlatform.options[0])
  const [settingsOpen, setSettingsOpen] = createSignal(false)
  const [cookie, setCookie] = createSignal('')
  const selected = () => platforms.find(item => item.id === platform()) ?? { id: platform(), name: '音源', placeholder: '' }
  const source = () => roomView().snapshot?.source
  const hosted = () => source()?.mode === 'hosted'
  const currentLabel = () => `${platforms.find(item => item.id === source()?.provider)?.name ?? '当前平台'}${source()?.credential === 'ready' ? '账号托管' : '匿名托管'}`
  const disabled = () => roomView().connection !== 'connected' || !!roomView().sourceBusy
  const overridden = () => roomView().sourceOverrides?.includes(platform())
  const web = usesWebTransport()
  const extensionBridge = web && getWebTransport() === 'extension'
  function sessionSource() {
    if (overridden()) return '房间单独设置'
    if (clientCookieStatus().modes[platform()] === 'manual') return '音源设置 · 手动 Cookie'
    if (extensionBridge) return '匿名托管'
    return web ? '音源设置 · 匿名取源' : '音源设置 · 网站 Cookie'
  }
  async function bind() {
    const supplied = cookie()
    setCookie('')
    await manageRoomSource('credential', supplied, platform())
  }
  function openSettings(id: HostedPlatform) {
    setCookie('')
    setPlatform(id)
    setSettingsOpen(true)
  }
  function closeSettings() {
    setSettingsOpen(false)
    setCookie('')
  }
  createEffect(() => roomView().isHost, (isHost) => { if (!isHost) closeSettings() })
  return (
    <details class="rounded-xl border border-border p-4">
      <summary class="cursor-pointer text-sm font-medium">房间音源 · 按平台设置</summary>
      <div class="pt-4 grid gap-4 text-sm">
        <p class="text-muted-foreground">本机正在使用：{hosted() && !roomView().personalSource ? currentLabel() : '个人音源'}。切换后会重新准备并追赶房间进度，主动暂离时保持暂停。</p>
        <ul class="grid gap-2" aria-label="各平台房间账号">
          <For each={platforms}>{item => (
            <li class="rounded-lg border border-border p-3 flex flex-wrap gap-2 items-center justify-between" data-platform={item.id}>
              <div class="min-w-0 grid gap-1"><span class="font-medium">{item.name}</span><p class="text-xs text-muted-foreground break-words">{roomView().sourceErrors?.[item.id] ?? (source()?.accounts?.[item.id]?.credential === 'ready' ? source()?.accounts?.[item.id]?.label : source()?.accounts?.[item.id]?.credential === 'invalid' ? '账号已失效，请更新音源设置' : '匿名托管')} · {source()?.modes?.[item.id] === 'hosted' ? '服务器取源' : '各自取源'}</p></div>
              <Show when={roomView().isHost}>
                <button class="border-btn h-8 px-3 text-xs" aria-label={`修改${item.name}取源设置`} disabled={disabled()} onClick={() => openSettings(item.id)}>修改</button>
              </Show>
            </li>
          )}</For>
        </ul>
        <Show when={hosted()}>
          <div class="flex flex-wrap gap-2">
            <button class="border-btn h-8 px-3" disabled={disabled()} onClick={() => usePersonalRoomSource(!roomView().personalSource)}>{roomView().personalSource ? '本机切回房间音源' : '本机改用个人音源'}</button>
            <Show when={roomView().isHost}><button class="border-btn h-8 px-3" disabled={disabled()} onClick={() => void manageRoomSource('retry-source')}>重试房间音源</button></Show>
          </div>
        </Show>
        <Show when={roomView().isHost}>
          <Dialog open={settingsOpen()} onClose={closeSettings} size="md" aria-labelledby="room-source-settings-title">
            <DialogHeader title={`${selected().name}取源设置`} titleId="room-source-settings-title" closeLabel="关闭取源设置" onClose={closeSettings} />
            <DialogBody class="grid auto-rows-max content-start gap-4">
              <div class="grid gap-3">
                <p class="font-medium">取源方式</p>
                <div class="flex gap-2 flex-wrap" role="group" aria-label={`${selected().name}取源方式`}>
                  <button class={clsx('border-btn h-8 px-3', source()?.modes?.[platform()] !== 'hosted' && 'bg-muted')} aria-pressed={source()?.modes?.[platform()] !== 'hosted' ? 'true' : 'false'} disabled={disabled() || source()?.modes?.[platform()] !== 'hosted'} onClick={() => void manageRoomSource('source', 'independent', platform())}>各自取源</button>
                  <button class={clsx('border-btn h-8 px-3', source()?.modes?.[platform()] === 'hosted' && 'bg-muted')} aria-pressed={source()?.modes?.[platform()] === 'hosted' ? 'true' : 'false'} disabled={disabled() || source()?.modes?.[platform()] === 'hosted'} onClick={() => void manageRoomSource('source', 'hosted', platform())}>服务器取源</button>
                </div>
                <p class="text-xs text-muted-foreground">未绑定账号时，服务器取源使用匿名权限。</p>
              </div>
              <div class="grid gap-3">
                <p class="text-sm">当前会话来源：{sessionSource()}</p>
                <p class="text-xs text-muted-foreground">{extensionBridge ? '房间可托管音源设置中的手动 Cookie，或使用下方绑定的专用 Cookie。跟随网站 Cookie 时，扩展使用网站登录态，房间使用匿名权限。' : '默认跟随房主音源设置中的当前会话；单独绑定后，此平台使用房间专用 Cookie，不受音源设置变化影响。无登录会话时匿名取源，成员不会收到 Cookie。'}</p>
                <div class="flex gap-2 flex-wrap">
                  <button class="btn px-3 h-8" disabled={disabled()} onClick={() => void syncRoomCredentials(platform())}>使用音源设置 Cookie</button>
                  <button class="border-btn px-3 h-8" onClick={() => { closeSettings(); navigate('/settings') }}>前往音源设置</button>
                </div>
              </div>
              <form class="grid gap-3" onSubmit={event => { event.preventDefault(); void bind() }}>
                <div class="grid gap-3">
                  <label class="grid gap-3 text-sm"><span>房间专用 Cookie</span>
                    <input type="password" class="input w-full" aria-label={`${selected().name}房间专用 Cookie`} value={cookie()} onInput={event => setCookie(event.currentTarget.value)} maxlength="4096" autocomplete="off" spellcheck={false} placeholder={selected().placeholder} disabled={disabled()} />
                  </label>
                  <p class="text-xs text-muted-foreground">仅提交至当前房间服务器并在内存保留，不保存到本机音源设置；绑定后此平台自动使用服务器取源。</p>
                </div>
                <div class="flex gap-2 flex-wrap">
                  <button type="submit" class="btn px-3 h-8" disabled={disabled() || !cookie().trim()}>绑定房间账号</button>
                  <Show when={source()?.accounts?.[platform()]?.credential && source()?.accounts?.[platform()]?.credential !== 'none'}><button type="button" class="border-btn h-8 px-3" disabled={disabled()} onClick={() => void manageRoomSource('revoke', undefined, platform())}>撤销房间账号</button></Show>
                </div>
              </form>
            </DialogBody>
          </Dialog>
        </Show>
      </div>
    </details>
  )
}
