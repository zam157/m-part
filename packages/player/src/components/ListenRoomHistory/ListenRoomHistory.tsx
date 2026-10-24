import { createEffect, createSignal, For, Show } from 'solid-js'
import { clsx } from 'cn/lite'
import { roomView, sendRoomChat } from '~/composables/listen-room'

export default function ListenRoomHistory() {
  const [filter, setFilter] = createSignal<'all' | 'chat' | 'operation'>('all')
  const [draft, setDraft] = createSignal('')
  const [unread, setUnread] = createSignal(false)
  const [sending, setSending] = createSignal(false)
  let list: HTMLDivElement | undefined
  let following = true
  const entries = () => (roomView().snapshot?.history ?? []).filter(entry => filter() === 'all' || entry.kind === filter())
  const disabled = () => sending() || roomView().interactionBusy || roomView().connection !== 'connected'
  const filters = [{ id: 'all', label: '全部' }, { id: 'chat', label: '聊天' }, { id: 'operation', label: '操作历史' }] as const
  const time = (at: number) => new Date(at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  function latest() {
    if (list) list.scrollTop = list.scrollHeight
    following = true; setUnread(false)
  }
  createEffect(() => entries().at(-1)?.id, () => {
    if (following) latest()
    else setUnread(true)
  })
  async function send() {
    const text = draft()
    if (!text.trim() || disabled()) return
    setSending(true)
    try {
      if (await sendRoomChat(text)) { if (draft() === text) setDraft(''); latest() }
    }
    finally { setSending(false) }
  }
  function handleKeyDown(event: KeyboardEvent) {
    // Some IMEs report Enter with isComposing=false but keyCode=229.
    if (event.key !== 'Enter' || event.shiftKey || event.isComposing || event.keyCode === 229) return
    event.preventDefault()
    if (!event.repeat) void send()
  }
  return (
    <section aria-label="房间聊天与操作历史" class="space-y-3 min-w-0">
      <div class="flex items-center gap-3 flex-wrap justify-between">
        <h3 class="font-semibold">聊天与动态</h3>
        <div class="flex gap-1" role="group" aria-label="记录筛选">
          <For each={filters}>{item => <button class={clsx('ghost-btn h-7 px-2 text-xs', filter() === item.id && 'bg-muted')} aria-pressed={filter() === item.id ? 'true' : 'false'} onClick={() => { following = true; setFilter(item.id); latest() }}>{item.label}</button>}</For>
        </div>
      </div>
      <div ref={list} class="h-72 overflow-y-auto overscroll-contain rounded-xl border border-border p-3 space-y-3" aria-label="房间记录" onScroll={() => { if (list) following = list.scrollHeight - list.scrollTop - list.clientHeight < 48; if (following) setUnread(false) }}>
        <Show when={entries().length} fallback={<p class="text-sm text-muted-foreground">暂无记录</p>}>
          <For each={entries()}>{entry => (
            <article class={clsx('text-sm break-words whitespace-pre-wrap [overflow-wrap:anywhere]', entry.kind === 'operation' && 'text-muted-foreground text-xs')}>
              <div class="flex gap-2 items-baseline flex-wrap"><span class="font-medium">{entry.name ?? '系统'}</span><span class="text-xs text-muted-foreground">{entry.kind === 'chat' ? '聊天' : '操作'}</span><time class="text-xs text-muted-foreground" datetime={new Date(entry.at).toISOString()}>{time(entry.at)}</time></div>
              <p class="mt-1">{entry.text}</p>
            </article>
          )}</For>
        </Show>
      </div>
      <Show when={unread()}><button class="ghost-btn h-7 text-xs px-2" onClick={latest}>有新记录，查看最新</button></Show>
      <form class="flex gap-2 items-end" onSubmit={event => { event.preventDefault(); void send() }}>
        <label class="flex flex-col gap-1 flex-1 min-w-0 text-xs text-muted-foreground">
          <span>发送消息（{draft().length}/500）</span>
          <textarea class="input block w-full resize-none h-20 text-sm" aria-label="聊天消息" title="Enter 发送，Shift + Enter 换行" value={draft()} onInput={event => setDraft(event.currentTarget.value)} onKeyDown={handleKeyDown} maxlength="500" placeholder="和房间里的朋友聊聊…" />
        </label>
        <button class="btn h-9 px-3 shrink-0" type="submit" disabled={disabled() || !draft().trim()}>{sending() ? '发送中…' : '发送'}</button>
      </form>
      <p class="text-xs text-muted-foreground">保留当前房间最近 200 条聊天与操作记录，新成员也可查看；房间结束或服务重启后清除。</p>
    </section>
  )
}
