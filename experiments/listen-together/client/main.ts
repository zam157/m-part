import { roomPosition } from '../../../shared/utils/listen-clock'
import { ListenLabSession } from './session'
import './style.css'

function element<T extends HTMLElement>(id: string) { return document.getElementById(id)! as T }
const text = (id: string, value: string) => { element(id).textContent = value }
const input = (id: string) => element<HTMLInputElement>(id)
const button = (id: string) => element<HTMLButtonElement>(id)
let session: ListenLabSession | undefined
function render() {
  if (!session) return
  const state = session.snapshot
  text('connection', `${session.connection} · ${session.isHost ? '房主' : '成员'} · 房间 ${state?.code ?? '—'} · 本机 ${session.status}${session.away ? '（主动暂离）' : ''}`)
  text('error', session.error)
  const target = state ? roomPosition(state, session.clock.now(performance.now())) : 0
  const samples = session.samples.filter(s => s.status === 'following' && s.connected).map(s => Math.abs(s.errorMs)).sort((a, b) => a - b)
  const p95 = samples.length ? samples[Math.floor((samples.length - 1) * 0.95)]!.toFixed(0) : '—'
  text('metrics', `房间：${state?.status ?? '—'} / ${state?.pauseReason ?? '—'} / revision ${state?.revision ?? '—'}\n本机：${session.audio.currentTime.toFixed(3)}s · 目标：${target.toFixed(3)}s · 偏差：${((session.audio.currentTime - target) * 1000).toFixed(0)}ms\n校时不确定性：±${session.clock.uncertaintyMs?.toFixed(1) ?? '—'}ms · 校正 seek：${session.seeks}\n跟随样本绝对目标偏差 P95：${p95}ms（${samples.length}/${session.samples.length} 样本；非双端差值）`)
  for (const id of ['play', 'pause', 'restart', 'seek']) (element(id) as HTMLButtonElement | HTMLInputElement).disabled = !session.isHost || !session.connected || session.busy
  button('create').disabled = !!state
  button('join').disabled = !!state
  button('leave').disabled = !state
  const list = element('members')
  const members = state?.members.map(m => `${m.name}${m.id === state.hostId ? '（房主）' : ''} · ${m.online ? '在线' : '离线'} · ${m.status} · 连接代次 ${m.generation}`) ?? []
  if (list.textContent !== members.join('')) list.replaceChildren(...members.map(value => { const li = document.createElement('li'); li.textContent = value; return li }))
}
session = new ListenLabSession(render)
button('create').onclick = () => session!.create(input('name').value || '听众')
button('join').onclick = () => session!.join(input('code').value, input('name').value || '听众')
button('leave').onclick = () => session!.leave()
button('play').onclick = () => session!.command('play')
button('pause').onclick = () => session!.command('pause')
button('restart').onclick = () => session!.command('restart')
input('seek').onchange = () => session!.command('seek', Number(input('seek').value))
button('away').onclick = () => session!.pauseLocal()
button('resume').onclick = () => session!.resumeLocal()
input('volume').oninput = () => { session!.audio.volume = Number(input('volume').value) }
input('threshold').onchange = () => { session!.threshold = Math.max(0.1, Math.min(2, Number(input('threshold').value) || 0.3)) }
button('buffer').onclick = () => session!.buffer(true)
button('unbuffer').onclick = () => session!.buffer(false)
button('blocked').onclick = () => { session!.simulateBlocked = true; text('error', '已设置：下次启动模拟受阻') }
button('disconnect').onclick = () => session!.disconnectForTest()
button('export').onclick = () => {
  const url = URL.createObjectURL(new Blob([JSON.stringify({
    protocol: 1, track: 'calibration-v1', userAgent: navigator.userAgent,
    memberId: session!.memberId, threshold: session!.threshold, samples: session!.samples, events: session!.events,
  }, null, 2)], { type: 'application/json' }))
  const link = document.createElement('a'); link.href = url; link.download = `listen-${session!.memberId ?? 'lab'}.json`; link.click()
  setTimeout(() => URL.revokeObjectURL(url), 1_000)
}
// Lab-only inspection hook; this entry is never included in the product extension.
Object.assign(window, { listenLab: session })
render()
