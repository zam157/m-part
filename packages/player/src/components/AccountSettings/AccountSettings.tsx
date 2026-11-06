import { createEffect, createSignal, Show } from 'solid-js'
import type { AccountSession } from '~/utils/account'
import { readAccountSession, signInWithGitHub, signOutAccount } from '~/utils/account'
import { errorMessage } from '~/utils/index'

export default function AccountSettings() {
  const [session, setSession] = createSignal<AccountSession>()
  const [busy, setBusy] = createSignal(false)
  const [error, setError] = createSignal(new URLSearchParams(window.location.search).get('login') === 'failed' ? 'GitHub 登录未完成，请重试' : '')

  async function load(signal?: AbortSignal) {
    try {
      const current = await readAccountSession(signal)
      if (!signal?.aborted) setSession(current)
    }
    catch (cause) { if (!signal?.aborted) setError(errorMessage(cause)) }
  }
  createEffect(() => true, () => {
    const controller = new AbortController()
    void load(controller.signal)
    return () => controller.abort()
  })

  async function signIn() {
    setBusy(true); setError('')
    try { await signInWithGitHub() }
    catch (cause) { setError(errorMessage(cause)); setBusy(false) }
  }
  async function signOut() {
    setBusy(true); setError('')
    try {
      await signOutAccount()
      setSession({ enabled: true, user: null })
    }
    catch (cause) { setError(errorMessage(cause)) }
    finally { setBusy(false) }
  }

  return (
    <section class="rounded-xl border border-border p-5 grid gap-3" aria-labelledby="mpart-account-title">
      <h2 id="mpart-account-title" class="text-base font-semibold">m-part 账号</h2>
      <Show when={session()} fallback={
        <Show when={error()} fallback={<p class="text-sm text-muted-foreground">正在检查登录状态…</p>}>
          <button type="button" class="border-btn h-8 px-3 justify-self-start" onClick={() => { setError(''); void load() }}>重试</button>
        </Show>
      }>
        <Show when={session()?.enabled} fallback={<p class="text-sm text-muted-foreground">当前站点尚未配置账号服务。</p>}>
          <Show when={session()?.user} fallback={
            <div class="grid gap-3">
              <p class="text-sm text-muted-foreground">登录后可跨设备使用一起听预设。</p>
              <button type="button" class="btn justify-self-start px-3" disabled={busy()} onClick={() => void signIn()}>使用 GitHub 登录</button>
            </div>
          }>
            <div class="flex flex-wrap items-center justify-between gap-3">
              <p class="text-sm text-muted-foreground">已登录为 {session()?.user?.name}</p>
              <button type="button" class="border-btn h-8 px-3" disabled={busy()} onClick={() => void signOut()}>退出登录</button>
            </div>
          </Show>
        </Show>
      </Show>
      <Show when={error()}><p class="text-sm text-destructive" role="alert">{error()}</p></Show>
    </section>
  )
}
