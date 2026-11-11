import { createEffect, createMemo, createSignal, Show } from 'solid-js'
import type { AccountSession } from '~/utils/account'
import { createAccountUser, readAccountSession, signInAccount, signOutAccount } from '~/utils/account'
import { errorMessage } from '~/utils/index'

export default function AccountSettings() {
  const [session, setSession] = createSignal<AccountSession>()
  const [busy, setBusy] = createSignal(false)
  const [error, setError] = createSignal('')
  const adminSession = createMemo(() => {
    const current = session()
    return current?.user?.isAdmin ? current : undefined
  })

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

  async function signIn(event: SubmitEvent & { currentTarget: HTMLFormElement }) {
    event.preventDefault()
    if (busy()) return
    const form = event.currentTarget
    const fields = new FormData(form)
    setBusy(true)
    setError('')
    try {
      await signInAccount(String(fields.get('username')), String(fields.get('password')))
      form.reset()
      await load()
    }
    catch (cause) { setError(errorMessage(cause)) }
    finally { setBusy(false) }
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
            <form class="grid gap-3" onSubmit={signIn}>
              <p class="text-sm text-muted-foreground">登录后可跨设备使用一起听预设。</p>
              <label class="grid gap-3 text-sm">
                用户名
                <input name="username" class="input" autocomplete="username" autocapitalize="none" spellcheck={false} required maxlength="32" />
              </label>
              <label class="grid gap-3 text-sm">
                密码
                <input name="password" class="input" type="password" autocomplete="current-password" required maxlength="128" />
              </label>
              <button type="submit" class="btn justify-self-start px-3" disabled={busy()}>登录</button>
            </form>
          }>
            <div class="flex flex-wrap items-center justify-between gap-3">
              <p class="text-sm text-muted-foreground">已登录为 {session()?.user?.name}</p>
              <button type="button" class="border-btn h-8 px-3" disabled={busy()} onClick={() => void signOut()}>退出登录</button>
            </div>
            <Show when={adminSession()} keyed>
              {admin => <CreateUserForm csrfToken={admin.csrfToken} />}
            </Show>
          </Show>
        </Show>
      </Show>
      <Show when={error()}><p class="text-sm text-destructive" role="alert">{error()}</p></Show>
    </section>
  )
}

function CreateUserForm(props: { csrfToken: string }) {
  const [busy, setBusy] = createSignal(false)
  const [error, setError] = createSignal('')
  const [created, setCreated] = createSignal('')

  async function createUser(event: SubmitEvent & { currentTarget: HTMLFormElement }) {
    event.preventDefault()
    if (busy()) return
    const form = event.currentTarget
    const fields = new FormData(form)
    setBusy(true)
    setError('')
    setCreated('')
    try {
      const result = await createAccountUser(String(fields.get('username')), String(fields.get('password')), props.csrfToken)
      setCreated(result.username)
      form.reset()
    }
    catch (cause) { setError(errorMessage(cause)) }
    finally { setBusy(false) }
  }

  return (
    <form class="grid gap-3 border-t border-border pt-3" onSubmit={createUser}>
      <h3 class="text-sm font-semibold">创建普通用户</h3>
      <label class="grid gap-3 text-sm">
        新用户名
        <input name="username" class="input" autocomplete="off" autocapitalize="none" spellcheck={false}
          required minlength="3" maxlength="32" pattern="[A-Za-z0-9][A-Za-z0-9_\x2d]{2,31}" aria-describedby="new-username-help" />
        <span id="new-username-help" class="text-xs text-muted-foreground">3 到 32 个字符，使用英文字母、数字、下划线或连字符，以字母或数字开头。</span>
      </label>
      <label class="grid gap-3 text-sm">
        初始密码
        <input name="password" class="input" type="password" autocomplete="new-password" required minlength="12" maxlength="128"
          aria-describedby="new-password-help" />
        <span id="new-password-help" class="text-xs text-muted-foreground">至少 12 个字符。创建后可将用户名和密码交给用户。</span>
      </label>
      <button type="submit" class="btn justify-self-start px-3" disabled={busy()}>创建</button>
      <Show when={created()}><p class="text-sm text-muted-foreground" role="status">已创建用户 {created()}</p></Show>
      <Show when={error()}><p class="text-sm text-destructive" role="alert">{error()}</p></Show>
    </form>
  )
}
