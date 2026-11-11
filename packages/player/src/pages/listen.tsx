import { createSignal, For, Show } from 'solid-js'
import { TARGET_EXTENSION } from '@m-part/music/constants'
import RoomProfiles from '~/components/RoomProfiles/RoomProfiles'
import Dialog, { DialogBody, DialogHeader } from '~/components/Dialog/Dialog'
import { clsx } from 'cn/lite'
import { createListenRoom, endListenRoom, joiningRoom, joinListenRoom, leaveListenRoom, pauseRoomLocally, resumeRoomPlayback, roomPlayerActive, roomServer, roomView, setRoomServer, setRoomMemberRole } from '~/composables/listen-room'
import { playing, playQueue, prevNext, setPlaying, setShowPlayQueue } from '~/composables/player'
import ListenRoomHistory from '~/components/ListenRoomHistory/ListenRoomHistory'
import ListenRoomSources from '~/components/ListenRoomSources/ListenRoomSources'
import { roomStatusLabel } from '~/components/ListenRoomBar/ListenRoomBar'

const statuses = { loading: '准备音源', ready: '已就绪', following: '跟随中', buffering: '缓冲中', away: '主动暂离', blocked: '播放受阻', failed: '音源不可用' }

export default function ListenPage() {
  const [name, setName] = createSignal(localStorage.getItem('m-part:room-name') || '听众')
  const [code, setCode] = createSignal('')
  const [copied, setCopied] = createSignal(false)
  const [confirmEnd, setConfirmEnd] = createSignal(false)
  const snapshot = () => roomView().snapshot
  const offlineAdmins = () => snapshot()?.accountAdmins?.filter(admin => !snapshot()?.members.some(member => member.id === admin.id)) ?? []
  const ownerAbsent = () => snapshot()?.persistent && !snapshot()?.members.some(member => member.id === snapshot()?.hostId && member.online)
  const saveName = () => localStorage.setItem('m-part:room-name', name().trim())
  const join = (server: string, code: string) => { saveName(); void joinListenRoom(server, name(), code) }
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
      <div class="max-w-220 mx-auto grid gap-6">
        <header class="grid gap-2"><h1 class="text-8 font-bold">一起听</h1><p class="text-muted-foreground text-sm">在同一个房间听同一首歌。房主与管理员控制播放和队列，各平台默认服务器托管，也可切换各自取源。</p></header>
        <Show when={roomPlayerActive()} fallback={(
          <section class="rounded-2xl border border-border p-5 grid gap-5">
            <Show when={!TARGET_EXTENSION}>
              <RoomProfiles serverUrl={roomServer()} nickname={name()} joining={joiningRoom()} onSelectServer={setRoomServer} onJoin={join}
                onApply={profile => { setRoomServer(profile.serverUrl); setName(profile.nickname) }} />
            </Show>
            <div class="grid gap-3">
              <label class="grid gap-3 text-sm"><span>房间服务器</span>
                <input class="input" type="url" value={roomServer()} onInput={e => setRoomServer(e.currentTarget.value)} placeholder="https://rooms.example.com" autocomplete="url" />
              </label>
              <p class="text-xs text-muted-foreground">所有人填写同一个已启动的房间服务器地址，支持 HTTP 和 HTTPS。局域网可用 HTTP，公网建议使用 HTTPS。</p>
            </div>
            <label class="grid gap-3 text-sm"><span>房间内的称呼</span>
              <input class="input" maxlength="80" value={name()} onInput={e => setName(e.currentTarget.value)} autocomplete="nickname" />
            </label>
            <div class="grid grid-cols-2 gap-5 max-[600px]:grid-cols-1">
              <div class="grid content-start gap-3 rounded-xl bg-muted/50 p-4">
                <h2 class="font-semibold">创建房间</h2>
                <p class="text-xs text-muted-foreground">创建后将把房主音源设置中当前应用的登录 Cookie 提交到所填服务器；仅保留在服务器内存。未登录时匿名取源，Web 网站 Cookie 不可读取时也使用匿名取源。</p>
                <p class="text-sm text-muted-foreground">带上当前队列的 {playQueue().length} 首歌；队列为空时，创建后再去搜索添加。</p>
                <button class="btn px-4 py-2 justify-self-start" disabled={joiningRoom()} onClick={() => { saveName(); void createListenRoom(roomServer(), name()) }}>创建</button>
              </div>
              <form class="grid content-start gap-3 rounded-xl bg-muted/50 p-4" onSubmit={e => { e.preventDefault(); join(roomServer(), code()) }}>
                <h2 class="font-semibold">加入朋友的房间</h2>
                <label class="grid gap-3 text-sm"><span>房间码</span><input class="input font-mono uppercase" maxlength="8" value={code()} onInput={e => setCode(e.currentTarget.value)} placeholder="8 位房间码" autocomplete="off" /></label>
                <button class="btn px-4 py-2 justify-self-start" type="submit" disabled={joiningRoom()}>加入</button>
              </form>
            </div>
          </section>
        )}>
          <section class="rounded-2xl border border-border p-5 grid gap-5">
            <div class="flex items-start gap-4 justify-between flex-wrap">
              <div class="grid gap-1">
                <p class="text-xs text-muted-foreground">{roomView().isHost ? '你是房主' : roomView().canControl ? '你是管理员' : '你是房间成员'}{snapshot()?.persistent ? ' · 长期房间' : ''}</p>
                <h2 class="font-mono text-8 font-semibold tracking-widest">{snapshot()?.code ?? '连接中…'}</h2>
                <p class="text-sm text-muted-foreground" role="status">{ownerAbsent() ? '房主暂时离线，房间会保留' : roomStatusLabel()}</p>
              </div>
              <div class="flex flex-wrap gap-2">
                <button class="ghost-btn px-3 h-9 border border-border" disabled={!snapshot()} onClick={copyCode}>{copied() ? '已复制' : '复制房间码'}</button>
                <button class="ghost-btn px-3 h-9 border border-border" onClick={leaveListenRoom}>{roomView().isHost && !snapshot()?.persistent ? '结束房间' : '退出房间'}</button>
                <Show when={roomView().isHost && snapshot()?.persistent}>
                  <button class="ghost-btn px-3 h-9 border border-border text-destructive" disabled={roomView().connection !== 'connected'} onClick={() => setConfirmEnd(true)}>结束房间</button>
                </Show>
              </div>
            </div>
            <div class="rounded-xl bg-muted/50 p-4 grid gap-3">
              <p class="font-semibold">{current()?.title ?? '还没有歌曲'}</p><p class="text-sm text-muted-foreground">{current()?.artist ?? '房主与管理员可以在搜索、歌单或首页选择歌曲'}</p>
              <Show when={roomView().canControl} fallback={(
                <button class="btn px-4 py-2 justify-self-start" onClick={() => roomView().away || roomView().status === 'blocked' || roomView().status === 'failed' ? resumeRoomPlayback() : pauseRoomLocally()}>{roomView().away || roomView().status === 'blocked' || roomView().status === 'failed' ? '恢复同步' : '暂停本机并暂离'}</button>
              )}>
                <div class="flex gap-2 flex-wrap">
                  <button class="ghost-btn px-3 h-9 border border-border" disabled={!current() || ownerAbsent() || roomView().connection !== 'connected'} onClick={() => prevNext(0)}>上一首</button>
                  <button class="btn px-4 h-9" disabled={!current() || ownerAbsent() || roomView().connection !== 'connected'} onClick={() => setPlaying(!playing())}>{playing() ? '暂停全员' : '开始播放'}</button>
                  <button class="ghost-btn px-3 h-9 border border-border" disabled={!current() || ownerAbsent() || roomView().connection !== 'connected'} onClick={() => prevNext(1)}>下一首</button>
                </div>
              </Show>
              <button class="ghost-btn px-3 h-8 text-sm justify-self-start" onClick={() => setShowPlayQueue(true)}>查看房间队列 · {snapshot()?.queue.length ?? 0} 首</button>
            </div>
            <ListenRoomSources />
            <div class="grid gap-3"><h3 class="font-semibold">房间成员 · {snapshot()?.members.length ?? 0}/5</h3>
              <ul class="grid gap-2"><For each={snapshot()?.members ?? []}>{member => (
                <li class="rounded-lg border border-border p-3 flex items-start justify-between gap-4 text-sm">
                  <div class="min-w-0 grid gap-1"><div class="flex flex-wrap items-baseline gap-2"><span class="font-medium">{member.name}</span><Show when={member.id === snapshot()?.hostId}><span class="text-xs text-muted-foreground">房主</span></Show><Show when={member.role === 'admin'}><span class="text-xs text-primary">管理员</span></Show><Show when={member.id === roomView().memberId}><span class="text-xs text-muted-foreground">你</span></Show></div>
                    <Show when={member.accountName}><span class="text-xs text-muted-foreground">账号 {member.accountName}</span></Show>
                    <Show when={member.message}><p class="text-xs text-destructive break-words">{member.message}</p></Show>
                  </div>
                  <div class="shrink-0 flex flex-col items-end gap-2">
                    <span class={clsx('text-xs', member.online ? 'text-muted-foreground' : 'text-destructive')}>{member.online ? statuses[member.status] : '已断开'}</span>
                    <Show when={roomView().isHost && member.id !== snapshot()?.hostId}>
                      <button class="ghost-btn text-xs h-7 px-2" disabled={roomView().connection !== 'connected' || roomView().interactionBusy} onClick={() => void setRoomMemberRole(member.id, member.role === 'admin' ? 'member' : 'admin')}>{member.role === 'admin' ? '撤销管理员' : snapshot()?.persistent && !member.accountName ? '设为临时管理员' : '设为管理员'}</button>
                    </Show>
                  </div>
                </li>
              )}</For></ul>
              <Show when={roomView().isHost && offlineAdmins().length}>
                <h4 class="text-sm font-medium">离线管理员</h4>
                <ul class="grid gap-2">
                  <For each={offlineAdmins()}>{admin => (
                    <li class="flex items-center justify-between gap-2 rounded-lg border border-border p-3 text-sm">
                      <span class="min-w-0 truncate">{admin.name} · {admin.accountName}</span>
                      <button class="ghost-btn shrink-0 text-xs px-2" disabled={roomView().connection !== 'connected' || roomView().interactionBusy}
                        onClick={() => void setRoomMemberRole(admin.id, 'member')}>撤销管理员</button>
                    </li>
                  )}</For>
                </ul>
              </Show>
            </div>
            <ListenRoomHistory />
            <p class="text-xs text-muted-foreground">成员不接收他人的账号凭据。试听、无版权或时长不一致的音源会标记为不可同步。退出后恢复你原来的队列，保持暂停；关闭应用页会停止播放。</p>
            <Dialog open={confirmEnd() && !!snapshot()?.persistent && roomView().isHost} onClose={() => setConfirmEnd(false)} aria-labelledby="end-room-title">
              <DialogHeader title="结束长期房间" titleId="end-room-title" onClose={() => setConfirmEnd(false)} />
              <DialogBody>
                <div class="grid gap-3">
                  <p class="text-sm text-muted-foreground">房间和已保存的管理员授权将被删除，原房间码将失效。</p>
                  <button type="button" class="btn px-3 justify-self-start" disabled={roomView().interactionBusy}
                    onClick={() => void endListenRoom().then(ok => { if (ok) setConfirmEnd(false) })}>确认结束</button>
                </div>
              </DialogBody>
            </Dialog>
          </section>
        </Show>
      </div>
    </div>
  )
}
