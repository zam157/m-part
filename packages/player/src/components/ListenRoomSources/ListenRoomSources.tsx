import type { HostedPlatform } from '@m-part/listen-core/protocol'
import { createSignal, For, Show } from 'solid-js'
import { clsx } from 'cn/lite'
import { manageRoomSource, roomView, usePersonalRoomSource } from '~/composables/listen-room'

/** Credentials stay only in this input until the host explicitly submits them. */
export default function ListenRoomSources() {
  const platforms = [{ id: 'netease', name: '网易云', placeholder: 'MUSIC_U=…; __csrf=…' }, { id: 'qq', name: 'QQ 音乐', placeholder: 'qqmusic_uin=…; qqmusic_key=…; eas_sid=…' }, { id: 'bili', name: 'BiliBili', placeholder: 'SESSDATA=…; bili_jct=…; DedeUserID=…' }] as const
  const [platform, setPlatform] = createSignal<HostedPlatform>('netease')
  let dialog!: HTMLDialogElement
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
  function openSettings(id: HostedPlatform) {
    setCookie('')
    setPlatform(id)
    dialog.showModal()
  }
  return (
    <details class="rounded-xl border border-border p-4">
      <summary class="cursor-pointer text-sm font-medium">房间音源 · 按平台设置</summary>
      <div class="mt-4 space-y-4 text-sm">
        <p class="text-muted-foreground">本机正在使用：{hosted() && !roomView().personalSource ? currentLabel() : '个人音源'}。切换后会重新准备并追赶房间进度，主动暂离时保持暂停。</p>
        <ul class="space-y-2" aria-label="各平台房间账号">
          <For each={platforms}>{item => (
            <li class="rounded-lg border border-border p-3 flex flex-wrap gap-2 items-center justify-between" data-platform={item.id}>
              <div class="min-w-0"><span class="font-medium">{item.name}</span><p class="text-xs text-muted-foreground mt-1 break-words">{source()?.accounts?.[item.id]?.credential === 'ready' ? source()?.accounts?.[item.id]?.label : source()?.accounts?.[item.id]?.credential === 'invalid' ? '账号已失效，请重新绑定或切换各自取源' : '未绑定账号'} · {source()?.modes?.[item.id] === 'hosted' ? '服务器取源' : '各自取源'}</p></div>
              <Show when={roomView().isHost}>
                <button class="border-btn h-8 px-3 text-xs" aria-label={`修改${item.name}取源设置`} disabled={disabled()} onClick={() => openSettings(item.id)}>修改</button>
              </Show>
            </li>
          )}</For>
        </ul>
        <Show when={hosted()}>
          <button class="border-btn h-8 px-3" disabled={disabled()} onClick={() => usePersonalRoomSource(!roomView().personalSource)}>{roomView().personalSource ? '本机切回房间音源' : '本机改用个人音源'}</button>
        </Show>
        <Show when={roomView().isHost}>
          <Show when={hosted()}><button class="border-btn h-8 px-3" disabled={disabled()} onClick={() => void manageRoomSource('retry-source')}>重试房间音源</button></Show>
          <dialog ref={dialog} aria-labelledby="room-source-settings-title" class="m-auto w-[min(32rem,calc(100vw-2rem))] max-w-none max-h-[calc(100svh-2rem)] rounded-2xl border border-border bg-background text-foreground p-0 shadow-xl backdrop:bg-black/50" onClose={() => setCookie('')}>
            <div class="p-5 space-y-5">
              <div class="flex items-center justify-between gap-3">
                <h2 id="room-source-settings-title" class="text-lg font-semibold">{selected().name}取源设置</h2>
                <button class="ghost-btn h-8 px-2" aria-label="关闭取源设置" onClick={() => dialog.close()}>关闭</button>
              </div>
              <div class="space-y-2">
                <p class="font-medium">取源方式</p>
                <div class="flex gap-2 flex-wrap" role="group" aria-label={`${selected().name}取源方式`}>
                  <button class={clsx('border-btn h-8 px-3', source()?.modes?.[platform()] !== 'hosted' && 'bg-muted')} aria-pressed={source()?.modes?.[platform()] !== 'hosted' ? 'true' : 'false'} disabled={disabled() || source()?.modes?.[platform()] !== 'hosted'} onClick={() => void manageRoomSource('source', 'independent', platform())}>各自取源</button>
                  <button class={clsx('border-btn h-8 px-3', source()?.modes?.[platform()] === 'hosted' && 'bg-muted')} aria-pressed={source()?.modes?.[platform()] === 'hosted' ? 'true' : 'false'} disabled={disabled() || source()?.modes?.[platform()] === 'hosted'} onClick={() => void manageRoomSource('source', 'hosted', platform())}>服务器取源</button>
                </div>
                <p class="text-xs text-muted-foreground">未绑定账号时，服务器取源使用匿名权限。</p>
              </div>
              <form class="space-y-3" onSubmit={event => { event.preventDefault(); void bind() }}>
                <p class="text-xs text-muted-foreground">绑定账号后此平台自动使用服务器取源。Cookie 只提交至房间服务器，不会发送给其他成员；凭据仅保留在服务器内存中。</p>
                <label class="block">{selected().name}登录 Cookie
                  <input type="password" class="input mt-2 w-full" value={cookie()} onInput={event => setCookie(event.currentTarget.value)} maxlength="4096" autocomplete="off" spellcheck={false} placeholder={selected().placeholder} disabled={disabled()} />
                </label>
                <div class="flex gap-2 flex-wrap">
                  <button type="submit" class="btn px-3 h-8" disabled={disabled() || !cookie().trim()}>{roomView().sourceBusy ? '正在处理…' : '绑定账号'}</button>
                  <Show when={source()?.accounts?.[platform()]?.credential && source()?.accounts?.[platform()]?.credential !== 'none'}>
                    <button type="button" class="border-btn h-8 px-3" disabled={disabled()} onClick={() => void manageRoomSource('revoke', undefined, platform())}>撤销账号</button>
                  </Show>
                </div>
              </form>
            </div>
          </dialog>
        </Show>
      </div>
    </details>
  )
}
