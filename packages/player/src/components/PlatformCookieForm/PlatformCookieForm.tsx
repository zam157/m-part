import type { ProviderName } from '@m-part/music/types/provider'
import { createSignal, Show } from 'solid-js'
import { clientCookieStatus, saveClientCookie } from '~/composables/client-cookies'
import { errorMessage } from '~/utils/index'

export default function PlatformCookieForm(props: { source: ProviderName, label: string, placeholder: string, url: string }) {
  const [value, setValue] = createSignal('')
  const [busy, setBusy] = createSignal(false)
  const [error, setError] = createSignal('')
  const [message, setMessage] = createSignal('')
  const configured = () => clientCookieStatus().configured[props.source]
  async function save(clear = false) {
    if (busy()) return
    setBusy(true); setError(''); setMessage('')
    try {
      await saveClientCookie(props.source, clear ? '' : value())
      setValue('')
      setMessage(clear ? '已恢复使用网站 Cookie。' : '已保存，后续请求优先使用手动 Cookie。')
    }
    catch (error) { setError(errorMessage(error)) }
    finally { setBusy(false) }
  }
  return (
    <form class="rounded-xl border border-border p-5 space-y-4" aria-label={`${props.label} Cookie 设置`} onSubmit={event => { event.preventDefault(); void save() }}>
      <header class="flex items-start justify-between gap-3">
        <div><h2 class="text-base font-semibold">{props.label}</h2><p class="text-sm text-muted-foreground mt-1">{configured() ? '当前使用：手动 Cookie' : '当前使用：网站 Cookie'}</p></div>
        <a class="ghost-btn px-2 shrink-0" href={props.url} target="_blank" rel="noopener noreferrer">打开网站<span class="i-lucide:external-link text-4" /></a>
      </header>
      <label class="block text-sm space-y-2"><span>{props.label} Cookie</span>
        <input type="password" class="input h-10" autocomplete="off" spellcheck={false} aria-label={`${props.label} Cookie`} placeholder={configured() ? '已设置，填写新 Cookie 可替换' : props.placeholder} value={value()} disabled={busy()} onInput={event => { setValue(event.currentTarget.value); setMessage(''); setError('') }} />
      </label>
      <div class="flex items-center gap-3 flex-wrap">
        <button type="submit" class="btn h-9 px-3" disabled={busy() || !value().trim()}>{busy() ? '正在保存…' : configured() ? '更新 Cookie' : '保存 Cookie'}</button>
        <button type="button" class="border-btn h-9 px-3" disabled={busy() || !configured()} onClick={() => void save(true)}>恢复网站 Cookie</button>
      </div>
      <Show when={error()}><p class="text-sm text-destructive break-words" role="alert">{error()}</p></Show>
      <Show when={message()}><p class="text-sm text-muted-foreground" role="status">{message()}</p></Show>
    </form>
  )
}
