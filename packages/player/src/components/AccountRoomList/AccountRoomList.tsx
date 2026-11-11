import type { AccountRoom } from '@m-part/listen-core/protocol'
import { createEffect, createSignal, For, Show } from 'solid-js'
import { readAccountRooms } from '~/utils/account'
import { errorMessage } from '~/utils/index'

export default function AccountRoomList(props: {
  server: string
  selectedServer: string
  joining: boolean
  onSelectServer: (server: string) => void
  onJoin: (server: string, code: string) => void
}) {
  const [rooms, setRooms] = createSignal<AccountRoom[]>()
  const [error, setError] = createSignal('')
  const [refresh, setRefresh] = createSignal(0)
  createEffect(() => [props.server, refresh()] as const, ([server]) => {
    const controller = new AbortController()
    setRooms(undefined)
    setError('')
    void readAccountRooms(server, controller.signal).then((rooms) => {
      if (!controller.signal.aborted) setRooms(rooms)
    }).catch((cause) => {
      if (!controller.signal.aborted) setError(errorMessage(cause))
    })
    return () => controller.abort()
  })

  return (
    <section class="grid gap-3" aria-labelledby="account-rooms-title">
      <div class="flex flex-wrap items-center justify-between gap-2">
        <h2 id="account-rooms-title" class="text-sm font-semibold">长期房间</h2>
        <Show when={props.server !== props.selectedServer}>
          <button type="button" class="border-btn px-3" onClick={() => props.onSelectServer(props.server)}>使用配对服务器</button>
        </Show>
      </div>
      <p class="text-xs text-muted-foreground">登录后使用配对服务器创建房间，离开后仍可从这里进入。</p>
      <Show when={error()} fallback={
        <Show when={rooms()} fallback={<p class="text-xs text-muted-foreground">正在读取长期房间…</p>}>
          <Show when={rooms()?.length} fallback={<p class="text-xs text-muted-foreground">暂无创建或管理的长期房间</p>}>
            <ul class="grid gap-2">
              <For each={rooms() ?? []}>{room => (
                <li class="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border p-2 text-sm">
                  <div class="flex min-w-0 flex-wrap items-center gap-2">
                    <span class="font-mono">{room.code}</span>
                    <span class="text-xs text-muted-foreground">{room.role === 'host' ? '房主' : '管理员'}</span>
                    <Show when={room.title}><span class="truncate">{room.title}</span></Show>
                  </div>
                  <button type="button" class="border-btn px-3" disabled={props.joining} onClick={() => props.onJoin(props.server, room.code)}>进入</button>
                </li>
              )}</For>
            </ul>
          </Show>
        </Show>
      }>
        <div class="flex flex-wrap items-center gap-2">
          <p class="text-xs text-destructive" role="alert">{error()}</p>
          <button type="button" class="border-btn px-3" onClick={() => setRefresh(value => value + 1)}>重试</button>
        </div>
      </Show>
    </section>
  )
}
