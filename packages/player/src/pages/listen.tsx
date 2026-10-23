import { createSignal, For, Show } from 'solid-js'
import { clsx } from 'cn/lite'
import { createListenRoom, joiningRoom, joinListenRoom, leaveListenRoom, pauseRoomLocally, resumeRoomPlayback, roomPlayerActive, roomServer, roomView, setRoomServer } from '~/composables/listen-room'
import { playing, playQueue, prevNext, setPlaying, setShowPlayQueue } from '~/composables/player'
import ListenRoomSources from '~/components/ListenRoomSources/ListenRoomSources'
import { roomStatusLabel } from '~/components/ListenRoomBar/ListenRoomBar'

const statuses = { loading: '准备音源', ready: '已就绪', following: '跟随中', buffering: '缓冲中', away: '主动暂离', blocked: '播放受阻', failed: '音源不可用' }

export default function ListenPage() {
  const [name, setName] = createSignal(localStorage.getItem('m-part:room-name') || '听众')
  const [code, setCode] = createSignal('')
  const [copied, setCopied] = createSignal(false)
  const snapshot = () => roomView().snapshot
  const saveName = () => localStorage.setItem('m-part:room-name', name().trim())
  const current = () => {
    const state = snapshot()
    return state?.currentIndex === null || state?.currentIndex === undefined ? undefined : state.queue[state.currentIndex]
  }
  async function copyCode() {
    try { await navigator.clipboard.writeText(snapshot()?.code ?? ''); setCopied(true) }
    catch { setCopied(false) }
  }
  return (
    <div class="flex-1 min-w-0 min-h-0 overflow-auto p-6 max-[760px]:p-4">
      <div class="max-w-220 mx-auto space-y-6">
        <header><h1 class="text-8 font-bold">一起听</h1><p class="text-muted-foreground text-sm mt-2">在同一个房间听同一首歌。房主控制播放和队列，可各自取源，也可选用房主配置的网易云托管音源。</p></header>
        <Show when={roomPlayerActive()} fallback={(
          <section class="rounded-2xl border border-border p-5 space-y-5">
            <label class="block text-sm">房间服务器
              <input class="mt-2 w-full rounded-lg border border-input bg-background px-3 py-2 outline-none focus:border-ring" type="url" value={roomServer()} onInput={e => setRoomServer(e.currentTarget.value)} placeholder="https://rooms.example.com" autocomplete="url" />
            </label>
            <p class="text-xs text-muted-foreground">所有人填写同一个已启动的房间服务器地址，支持 HTTP 和 HTTPS。局域网可用 HTTP，公网建议使用 HTTPS。</p>
            <label class="block text-sm">房间内的称呼
              <input class="mt-2 w-full rounded-lg border border-input bg-background px-3 py-2 outline-none focus:border-ring" maxlength="80" value={name()} onInput={e => setName(e.currentTarget.value)} autocomplete="nickname" />
            </label>
            <div class="grid grid-cols-2 gap-5 max-[600px]:grid-cols-1">
              <div class="space-y-3 rounded-xl bg-muted/50 p-4">
                <h2 class="font-semibold">创建房间</h2>
                <p class="text-sm text-muted-foreground">带上当前队列的 {playQueue().length} 首歌；队列为空时，创建后再去搜索添加。</p>
                <button class="btn px-4 py-2" disabled={joiningRoom()} onClick={() => { saveName(); void createListenRoom(roomServer(), name()) }}>用当前队列创建</button>
              </div>
              <form class="space-y-3 rounded-xl bg-muted/50 p-4" onSubmit={e => { e.preventDefault(); saveName(); void joinListenRoom(roomServer(), name(), code()) }}>
                <h2 class="font-semibold">加入朋友的房间</h2>
                <label class="block text-sm">房间码<input class="mt-2 w-full rounded-lg border border-input bg-background px-3 py-2 font-mono uppercase outline-none focus:border-ring" maxlength="8" value={code()} onInput={e => setCode(e.currentTarget.value)} placeholder="8 位房间码" autocomplete="off" /></label>
                <button class="btn px-4 py-2" type="submit" disabled={joiningRoom()}>加入并准备播放</button>
              </form>
            </div>
          </section>
        )}>
          <section class="rounded-2xl border border-border p-5 space-y-5">
            <div class="flex items-start gap-4 justify-between flex-wrap">
              <div><p class="text-xs text-muted-foreground">{roomView().isHost ? '你是房主' : '你是房间成员'}</p><h2 class="font-mono text-8 font-semibold tracking-widest mt-1">{snapshot()?.code ?? '连接中…'}</h2><p class="text-sm text-muted-foreground mt-1" role="status">{roomStatusLabel()}</p></div>
              <div class="flex gap-2"><button class="ghost-btn px-3 h-9 border border-border" disabled={!snapshot()} onClick={copyCode}>{copied() ? '已复制' : '复制房间码'}</button><button class="ghost-btn px-3 h-9 border border-border" onClick={leaveListenRoom}>{roomView().isHost ? '结束房间' : '退出房间'}</button></div>
            </div>
            <div class="rounded-xl bg-muted/50 p-4 space-y-3">
              <p class="font-semibold">{current()?.title ?? '还没有歌曲'}</p><p class="text-sm text-muted-foreground">{current()?.artist ?? '房主可以在搜索、歌单或首页选择歌曲'}</p>
              <Show when={roomView().isHost} fallback={(
                <button class="btn px-4 py-2" onClick={() => roomView().away || roomView().status === 'blocked' || roomView().status === 'failed' ? resumeRoomPlayback() : pauseRoomLocally()}>{roomView().away || roomView().status === 'blocked' || roomView().status === 'failed' ? '恢复同步' : '暂停本机并暂离'}</button>
              )}>
                <div class="flex gap-2 flex-wrap">
                  <button class="ghost-btn px-3 h-9 border border-border" disabled={!current()} onClick={() => prevNext(0)}>上一首</button>
                  <button class="btn px-4 h-9" disabled={!current()} onClick={() => setPlaying(!playing())}>{playing() ? '暂停全员' : '开始播放'}</button>
                  <button class="ghost-btn px-3 h-9 border border-border" disabled={!current()} onClick={() => prevNext(1)}>下一首</button>
                </div>
              </Show>
              <button class="ghost-btn px-3 h-8 text-sm" onClick={() => setShowPlayQueue(true)}>查看房间队列 · {snapshot()?.queue.length ?? 0} 首</button>
            </div>
            <ListenRoomSources />
            <div><h3 class="font-semibold mb-3">房间成员 · {snapshot()?.members.length ?? 0}/5</h3>
              <ul class="space-y-2"><For each={snapshot()?.members ?? []}>{member => (
                <li class="rounded-lg border border-border p-3 flex items-start justify-between gap-4 text-sm">
                  <div class="min-w-0"><span class="font-medium">{member.name}</span><Show when={member.id === snapshot()?.hostId}><span class="ml-2 text-xs text-muted-foreground">房主</span></Show><Show when={member.id === roomView().memberId}><span class="ml-2 text-xs text-muted-foreground">你</span></Show><Show when={member.message}><p class="text-xs text-destructive mt-1 break-words">{member.message}</p></Show></div>
                  <span class={clsx('shrink-0 text-xs', member.online ? 'text-muted-foreground' : 'text-destructive')}>{member.online ? statuses[member.status] : '已断开'}</span>
                </li>
              )}</For></ul>
            </div>
            <p class="text-xs text-muted-foreground">成员不接收他人的账号凭据。试听、无版权或时长不一致的音源会标记为不可同步。退出后恢复你原来的队列，保持暂停；关闭应用页会停止播放。</p>
          </section>
        </Show>
      </div>
    </div>
  )
}
