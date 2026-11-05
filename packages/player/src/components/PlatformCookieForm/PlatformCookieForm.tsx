import type { ProviderCookieConfig, ProviderName } from '@m-part/music/types/provider'
import { createSignal, Show } from 'solid-js'
import type { ClientCookieMode } from '@m-part/music/client-cookies'
import { clientCookieStatus, saveClientCookie, selectClientCookieMode } from '~/composables/client-cookies'
import { errorMessage } from '~/utils/index'
import Select from '~/components/Select/Select'

const cookieModes = [{ value: 'manual', label: '手动 Cookie' }, { value: 'website', label: '网站 Cookie' }] as const

export default function PlatformCookieForm(props: { source: ProviderName, config: ProviderCookieConfig }) {
  const [value, setValue] = createSignal('')
  const [busy, setBusy] = createSignal(false)
  const [error, setError] = createSignal('')
  const [message, setMessage] = createSignal('')
  const configured = () => clientCookieStatus().configured[props.source]
  const mode = () => clientCookieStatus().modes[props.source] ?? 'website'
  let pending = false
  async function run(action: () => Promise<void>, success: string, clearInput = false) {
    if (pending) return
    pending = true
    setBusy(true); setError(''); setMessage('')
    try {
      await action()
      if (clearInput) setValue('')
      setMessage(success)
    }
    catch (error) { setError(errorMessage(error)) }
    finally { pending = false; setBusy(false) }
  }
  const save = () => run(() => saveClientCookie(props.source, value()), '已保存 Cookie，按所选来源使用。', true)
  const clear = () => run(() => saveClientCookie(props.source, ''), '已清除本地保存的 Cookie。', true)
  const selectMode = (next: ClientCookieMode) => run(() => selectClientCookieMode(props.source, next), '已切换 Cookie 来源，已保存的 Cookie 保持不变。')
  return (
    <form class="rounded-xl border border-border p-5 grid gap-4" aria-label={`${props.config.label} Cookie 设置`} onSubmit={event => { event.preventDefault(); void save() }}>
      <header class="flex items-start justify-between gap-3">
        <div class="grid gap-1"><h2 class="text-base font-semibold">{props.config.label}</h2><p class="text-sm text-muted-foreground">{configured() ? '已保存手动 Cookie' : '尚未保存手动 Cookie'}</p></div>
        <a class="ghost-btn px-2 shrink-0" href={props.config.loginUrl} target="_blank" rel="noopener noreferrer">打开网站<span class="i-lucide:external-link text-4" /></a>
      </header>
      <div class="grid gap-3">
        <label class="grid gap-3 text-sm"><span>Cookie 来源</span>
          <Select options={cookieModes} aria-label={`${props.config.label} Cookie 来源`} value={mode()} disabled={busy()} triggerClass="w-full" onValueChange={next => { void selectMode(next) }} />
        </label>
        <Show when={mode() === 'manual' && !configured()}><p class="text-sm text-muted-foreground">请先填写并保存手动 Cookie。</p></Show>
      </div>
      <label class="grid gap-3 text-sm"><span>{props.config.label} Cookie</span>
        <input type="password" class="input" autocomplete="off" spellcheck={false} aria-label={`${props.config.label} Cookie`} placeholder={configured() ? '已设置，填写新 Cookie 可替换' : props.config.placeholder} value={value()} disabled={busy()} onInput={event => { setValue(event.currentTarget.value); setMessage(''); setError('') }} />
      </label>
      <div class="flex items-center gap-3 flex-wrap">
        <button type="submit" class="btn h-9 px-3" disabled={busy() || !value().trim()}>{busy() ? '保存中…' : '保存'}</button>
        <button type="button" class="border-btn h-9 px-3" disabled={busy() || !configured()} onClick={() => void clear()}>清除</button>
      </div>
      <Show when={error()}><p class="text-sm text-destructive break-words" role="alert">{error()}</p></Show>
      <Show when={message()}><p class="text-sm text-muted-foreground" role="status">{message()}</p></Show>
    </form>
  )
}
