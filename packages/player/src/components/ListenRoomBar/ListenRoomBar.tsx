import { useNavigate } from '@solidjs/router'
import { Show } from 'solid-js'
import { leaveListenRoom, pauseRoomLocally, resumeRoomPlayback, roomPlayerActive, roomView } from '~/composables/listen-room'

export const roomStatusLabel = () => {
  const view = roomView()
  if (view.connection === 'connecting') return '正在连接房间'
  if (view.connection === 'reconnecting') return '连接中断，正在重连'
  if (view.snapshot?.source?.error && !view.personalSource && view.snapshot.source.mode === 'hosted') return '房间音源不可用'
  if (view.away) return '已暂离同步'
  if (view.inSync) return '已同步'
  if (view.status === 'ready' && view.snapshot?.status === 'paused') return '房间已暂停'
  return { loading: '正在准备音源', ready: '等待房主或管理员播放', following: '正在跟随', buffering: '音频缓冲中', away: '已暂离同步', blocked: '请点击恢复以允许播放', failed: '本机音源不可用' }[view.status]
}

export default function ListenRoomBar() {
  const navigate = useNavigate()
  return (
    <Show when={roomPlayerActive()}>
      <aside aria-label="一起听状态" class="shrink-0 border-t border-border bg-accent/60 px-4 py-2 flex items-center gap-3 text-xs min-w-0 max-[520px]:flex-wrap">
        <span class="i-lucide:headphones text-4 shrink-0" />
        <button class="min-w-0 flex-1 text-left truncate" onClick={() => navigate('/listen')}>
          一起听 · {roomView().snapshot?.code ?? '连接中'} · {roomStatusLabel()}
        </button>
        <Show when={!roomView().isHost}>
          <button class="ghost-btn px-2 h-7" onClick={() => roomView().away ? resumeRoomPlayback() : pauseRoomLocally()}>{roomView().away ? '恢复同步' : '暂离'}</button>
        </Show>
        <Show when={roomView().status === 'blocked' || roomView().status === 'failed'}>
          <button class="ghost-btn px-2 h-7" onClick={resumeRoomPlayback}>恢复播放</button>
        </Show>
        <button class="ghost-btn px-2 h-7" onClick={leaveListenRoom}>退出</button>
      </aside>
    </Show>
  )
}
