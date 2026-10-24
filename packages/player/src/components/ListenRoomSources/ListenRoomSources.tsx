import type { HostedPlatform } from '@m-part/listen-core/protocol'
import { createSignal, For, Show } from 'solid-js'
import { clsx } from 'cn/lite'
import { manageRoomSource, roomServer, roomView, usePersonalRoomSource } from '~/composables/listen-room'
import { canSubmitRoomCredential } from '~/utils/room-http'

/** Credentials stay only in this input until the host explicitly submits them. */
export default function ListenRoomSources() {
  const platforms = [{ id: 'netease', name: '网易云', placeholder: 'MUSIC_U=…; __csrf=…' }, { id: 'qq', name: 'QQ 音乐', placeholder: 'qqmusic_uin=…; qqmusic_key=…; eas_sid=…' }, { id: 'bili', name: 'BiliBili', placeholder: 'SESSDATA=…; bili_jct=…; DedeUserID=…' }] as const
  const [platform, setPlatform] = createSignal<HostedPlatform>('netease')
  const selected = () => platforms.find(item => item.id === platform())!
  const [cookie, setCookie] = createSignal('')
  const source = () => roomView().snapshot?.source
  const hosted = () => source()?.mode === 'hosted'
  const currentLabel = () => `${platforms.find(item => item.id === source()?.provider)?.name ?? '当前平台'}${source()?.credential === 'ready' ? '账号托管' : '匿名托管'}`
  const disabled = () => roomView().connection !== 'connected' || !!roomView().sourceBusy
  async function bind() {
    const supplied = cookie()
    setCookie('')
    await manageRoomSource('credential', supplied, platform())
  }
  return (
    <details class="rounded-xl border border-border p-4">
      <summary class="cursor-pointer text-sm font-medium">房间音源 · {hosted() ? '服务器托管' : '各自取源'}</summary>
      <div class="mt-4 space-y-4 text-sm">
        <p class="text-muted-foreground">本机正在使用：{hosted() && !roomView().personalSource ? currentLabel() : '个人音源'}。切换后会重新准备并追赶房间进度，主动暂离时保持暂停。</p>
        <ul class="space-y-2" aria-label="各平台房间账号">
          <For each={platforms}>{item => (
            <li class="rounded-lg border border-border p-3 flex flex-wrap gap-2 items-center justify-between" data-platform={item.id}>
              <div class="min-w-0"><span class="font-medium">{item.name}</span><p class="text-xs text-muted-foreground mt-1 break-words">{source()?.accounts?.[item.id]?.credential === 'ready' ? source()?.accounts?.[item.id]?.label : source()?.accounts?.[item.id]?.credential === 'invalid' ? '账号已失效，可重新绑定或匿名重试' : '未绑定账号，使用匿名取源'}</p></div>
              <Show when={roomView().isHost && source()?.accounts?.[item.id]?.credential && source()?.accounts?.[item.id]?.credential !== 'none'}>
                <button class="ghost-btn h-8 px-2 text-xs" disabled={disabled()} onClick={() => void manageRoomSource('revoke', undefined, item.id)}>撤销{item.name}账号</button>
              </Show>
            </li>
          )}</For>
        </ul>
        <Show when={hosted()}>
          <button class="border-btn h-8 px-3" disabled={disabled()} onClick={() => usePersonalRoomSource(!roomView().personalSource)}>{roomView().personalSource ? '本机切回房间音源' : '本机改用个人音源'}</button>
        </Show>
        <Show when={roomView().isHost}>
          <div class="flex gap-2 flex-wrap" role="group" aria-label="房间取源模式">
            <button class={clsx('border-btn h-8 px-3', !hosted() && 'bg-muted')} aria-pressed={!hosted() ? 'true' : 'false'} disabled={disabled() || !hosted()} onClick={() => void manageRoomSource('source', 'independent')}>全员各自取源</button>
            <button class={clsx('border-btn h-8 px-3', hosted() && 'bg-muted')} aria-pressed={hosted() ? 'true' : 'false'} disabled={disabled() || hosted()} onClick={() => void manageRoomSource('source', 'hosted')}>全员使用服务器音源</button>
            <Show when={hosted()}><button class="border-btn h-8 px-3" disabled={disabled()} onClick={() => void manageRoomSource('retry-source')}>重试房间音源</button></Show>
          </div>
          <form class="space-y-3 rounded-lg bg-muted/50 p-3" onSubmit={event => { event.preventDefault(); void bind() }}>
            <p class="text-xs text-muted-foreground">服务器托管无需绑定账号，未绑定的平台按匿名权限取源。仅向你填写的服务器提交所选平台会话，不会自动读取浏览器 Cookie，不会发送给其他成员。三个平台的账号分别保存；绑定和撤销只影响对应平台，不会自动切换房间取源方式。凭据仅在服务内存保留，撤销、结束房间或服务重启后清除。</p>
            <label class="block">账号平台
              <select class="input mt-2 w-full" value={platform()} disabled={disabled()} onChange={event => { setCookie(''); setPlatform(event.currentTarget.value as HostedPlatform) }}>
                <For each={platforms}>{item => <option value={item.id}>{item.name}</option>}</For>
              </select>
            </label>
            <label class="block">{selected().name}登录 Cookie
              <input type="password" class="input mt-2 w-full" value={cookie()} onInput={event => setCookie(event.currentTarget.value)} maxlength="4096" autocomplete="off" spellcheck={false} placeholder={selected().placeholder} disabled={disabled() || !canSubmitRoomCredential(roomServer())} />
            </label>
            <Show when={!canSubmitRoomCredential(roomServer())}><p class="text-xs text-muted-foreground">提交账号需要 HTTPS；当前 HTTP 连接仍可使用各自取源或服务器匿名托管。本机回环地址可用 HTTP 调试。</p></Show>
            <button type="submit" class="btn px-3 h-8" disabled={disabled() || !cookie().trim() || !canSubmitRoomCredential(roomServer())}>{roomView().sourceBusy ? '正在处理…' : '绑定所选平台账号'}</button>
          </form>
        </Show>
      </div>
    </details>
  )
}
