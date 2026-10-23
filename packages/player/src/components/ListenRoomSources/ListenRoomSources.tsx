import { createSignal, Show } from 'solid-js'
import { clsx } from 'cn/lite'
import { manageRoomSource, roomServer, roomView, usePersonalRoomSource } from '~/composables/listen-room'
import { canSubmitRoomCredential } from '~/utils/room-http'

/** Credentials stay only in this input until the host explicitly submits them. */
export default function ListenRoomSources() {
  const [cookie, setCookie] = createSignal('')
  const source = () => roomView().snapshot?.source
  const hosted = () => source()?.mode === 'hosted'
  const disabled = () => roomView().connection !== 'connected' || !!roomView().sourceBusy
  async function bind() {
    const supplied = cookie()
    setCookie('')
    await manageRoomSource('credential', supplied)
  }
  return (
    <details class="rounded-xl border border-border p-4">
      <summary class="cursor-pointer text-sm font-medium">房间音源 · {hosted() ? '网易云托管实验' : '各自取源'}</summary>
      <div class="mt-4 space-y-4 text-sm">
        <p class="text-muted-foreground">本机正在使用：{hosted() && !roomView().personalSource ? '房间托管音源' : '个人音源'}。切换后会重新准备并追赶房间进度，主动暂离时保持暂停。</p>
        <p class="text-xs text-muted-foreground">房间账号：{source()?.credential === 'ready' ? source()?.label : source()?.credential === 'invalid' ? '已失效，需要重新绑定' : '未绑定'}。{source()?.error ? '房间音源暂不可用，请房主重试或切回个人音源。' : '托管实验目前仅支持网易云。'}</p>
        <Show when={hosted()}>
          <button class="border-btn h-8 px-3" disabled={disabled()} onClick={() => usePersonalRoomSource(!roomView().personalSource)}>{roomView().personalSource ? '本机切回房间音源' : '本机改用个人音源'}</button>
        </Show>
        <Show when={roomView().isHost}>
          <div class="flex gap-2 flex-wrap" role="group" aria-label="房间取源模式">
            <button class={clsx('border-btn h-8 px-3', !hosted() && 'bg-muted')} aria-pressed={!hosted() ? 'true' : 'false'} disabled={disabled() || !hosted()} onClick={() => void manageRoomSource('source', 'independent')}>全员各自取源</button>
            <button class={clsx('border-btn h-8 px-3', hosted() && 'bg-muted')} aria-pressed={hosted() ? 'true' : 'false'} disabled={disabled() || hosted() || source()?.credential !== 'ready'} onClick={() => void manageRoomSource('source', 'hosted')}>全员优先房间音源</button>
            <Show when={hosted() && source()?.credential === 'ready'}><button class="border-btn h-8 px-3" disabled={disabled()} onClick={() => void manageRoomSource('retry-source')}>重试房间音源</button></Show>
            <Show when={source()?.credential !== 'none' && source()?.credential}><button class="ghost-btn h-8 px-3" disabled={disabled()} onClick={() => void manageRoomSource('revoke')}>撤销房间账号</button></Show>
          </div>
          <form class="space-y-3 rounded-lg bg-muted/50 p-3" onSubmit={event => { event.preventDefault(); void bind() }}>
            <p class="text-xs text-muted-foreground">需要房间服务器开启托管实验。仅向你填写的服务器提交网易云会话，不会自动读取浏览器 Cookie，不会发送给其他成员。凭据仅在服务内存保留，撤销、结束房间或服务重启后清除。</p>
            <label class="block">网易云登录 Cookie
              <input type="password" class="input mt-2 w-full" value={cookie()} onInput={event => setCookie(event.currentTarget.value)} maxlength="4096" autocomplete="off" spellcheck={false} placeholder="MUSIC_U=…; __csrf=…" disabled={disabled() || !canSubmitRoomCredential(roomServer())} />
            </label>
            <Show when={!canSubmitRoomCredential(roomServer())}><p class="text-xs text-muted-foreground">提交账号需要 HTTPS；当前 HTTP 连接仍可使用各自取源。本机回环地址可用 HTTP 调试。</p></Show>
            <button type="submit" class="btn px-3 h-8" disabled={disabled() || !cookie().trim() || !canSubmitRoomCredential(roomServer())}>{roomView().sourceBusy ? '正在处理…' : '绑定并启用房间托管'}</button>
          </form>
        </Show>
      </div>
    </details>
  )
}
