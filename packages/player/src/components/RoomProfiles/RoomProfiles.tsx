import type { RoomProfile, RoomProfileInput } from '@m-part/listen-core/room-profile'
import { useNavigate } from '@solidjs/router'
import { createEffect, createMemo, createSignal, Show } from 'solid-js'
import Dialog, { DialogBody, DialogHeader } from '~/components/Dialog/Dialog'
import Select from '~/components/Select/Select'
import type { AccountSession } from '~/utils/account'
import { AccountError, createRoomProfile, deleteRoomProfile, readAccountSession, readRoomProfiles, updateRoomProfile } from '~/utils/account'
import { errorMessage } from '~/utils/index'

interface RoomProfilesProps {
  serverUrl: string
  nickname: string
  onApply: (profile: RoomProfile) => void
}

export default function RoomProfiles(props: RoomProfilesProps) {
  const navigate = useNavigate()
  const [session, setSession] = createSignal<AccountSession>()
  const [profiles, setProfiles] = createSignal<RoomProfile[]>([])
  const [selectedId, setSelectedId] = createSignal<string>()
  const [draft, setDraft] = createSignal<RoomProfileInput>()
  const [editing, setEditing] = createSignal<RoomProfile>()
  const [busy, setBusy] = createSignal(false)
  const [confirmDelete, setConfirmDelete] = createSignal(false)
  const [loadError, setLoadError] = createSignal('')
  const [writeError, setWriteError] = createSignal('')
  const options = createMemo(() => profiles().map(profile => ({ value: profile.id, label: profile.label })))
  const selected = () => profiles().find(profile => profile.id === selectedId())

  async function load(signal?: AbortSignal) {
    setLoadError('')
    try {
      const current = await readAccountSession(signal)
      if (signal?.aborted) return
      setSession(current)
      setProfiles(current.user ? await readRoomProfiles(signal) : [])
    }
    catch (cause) { if (!signal?.aborted) setLoadError(errorMessage(cause)) }
  }
  createEffect(() => true, () => {
    const controller = new AbortController()
    void load(controller.signal)
    return () => controller.abort()
  })

  function edit(profile?: RoomProfile) {
    setWriteError('')
    setConfirmDelete(false)
    setEditing(profile)
    setDraft(profile
      ? { label: profile.label, serverUrl: profile.serverUrl, nickname: profile.nickname }
      : { label: '', serverUrl: props.serverUrl, nickname: props.nickname })
  }
  function changeDraft(field: keyof RoomProfileInput, value: string) {
    setDraft(current => current && ({ ...current, [field]: value }))
  }
  async function save(remove = false) {
    const current = session()
    const input = draft()
    const profile = editing()
    if (!current?.user || !input || busy()) return
    setBusy(true); setWriteError('')
    try {
      if (remove && profile) {
        await deleteRoomProfile(profile.id, profile.revision, current.csrfToken)
        setProfiles(items => items.filter(item => item.id !== profile.id))
        setSelectedId(undefined)
      }
      else {
        const saved = profile
          ? await updateRoomProfile(profile.id, { ...input, revision: profile.revision }, current.csrfToken)
          : await createRoomProfile(input, current.csrfToken)
        setProfiles(items => [...items.filter(item => item.id !== saved.id), saved].sort((a, b) => a.label.localeCompare(b.label)))
        setSelectedId(saved.id)
      }
      setDraft(undefined)
    }
    catch (cause) {
      setWriteError(errorMessage(cause))
      if (cause instanceof AccountError && cause.status === 409) await load()
    }
    finally { setBusy(false) }
  }
  const close = () => { if (!busy()) setDraft(undefined) }

  return (
    <>
      <Show when={session()?.enabled || loadError()}>
        <div class="grid gap-3">
          <Show when={session()?.user} fallback={
            <Show when={session()?.enabled}><button class="ghost-btn px-2 justify-self-start" type="button" onClick={() => navigate('/settings')}>登录以同步房间预设</button></Show>
          }>
            <div class="grid gap-3">
              <span id="room-profile-label" class="text-sm">房间预设</span>
              <div class="flex flex-wrap items-center gap-2">
                <Select aria-labelledby="room-profile-label" options={options()} value={selectedId()} onValueChange={setSelectedId} placeholder="选择预设" triggerClass="flex-1" disabled={!profiles().length} />
                <button type="button" class="border-btn h-8 px-3" disabled={!selected()} onClick={() => { const profile = selected(); if (profile) props.onApply(profile) }}>应用</button>
                <button type="button" class="border-btn h-8 px-3" disabled={!selected()} onClick={() => edit(selected())}>修改</button>
                <button type="button" class="border-btn h-8 px-3" onClick={() => edit()}>保存当前</button>
              </div>
            </div>
          </Show>
          <Show when={loadError()}>
            <p class="text-sm text-destructive" role="alert">{loadError()}</p>
            <button type="button" class="border-btn h-8 px-3 justify-self-start" onClick={() => void load()}>重试</button>
          </Show>
        </div>
      </Show>
      <Dialog open={!!draft()} onClose={close} aria-labelledby="room-profile-dialog-title">
        <Show when={draft()}>
          <DialogHeader title={editing() ? '修改房间预设' : '保存房间预设'} titleId="room-profile-dialog-title" onClose={close} />
          <DialogBody>
            <form class="grid gap-4" onSubmit={event => { event.preventDefault(); void save() }}>
              <label class="grid gap-3 text-sm">预设名称<input class="input" required maxlength="80" value={draft()?.label ?? ''} onInput={event => changeDraft('label', event.currentTarget.value)} /></label>
              <label class="grid gap-3 text-sm">服务器地址<input class="input" type="url" required maxlength="2048" value={draft()?.serverUrl ?? ''} onInput={event => changeDraft('serverUrl', event.currentTarget.value)} /></label>
              <label class="grid gap-3 text-sm">房间内的称呼<input class="input" required maxlength="80" value={draft()?.nickname ?? ''} onInput={event => changeDraft('nickname', event.currentTarget.value)} /></label>
              <Show when={writeError()}><p class="text-sm text-destructive" role="alert">{writeError()}</p></Show>
              <div class="flex flex-wrap items-center gap-2">
                <button type="submit" class="btn px-3" disabled={busy()}>保存</button>
                <Show when={editing()}>
                  <button type="button" class="border-btn h-8 px-3 text-destructive" disabled={busy()} onClick={() => confirmDelete() ? void save(true) : setConfirmDelete(true)}>{confirmDelete() ? '确认删除' : '删除'}</button>
                </Show>
              </div>
            </form>
          </DialogBody>
        </Show>
      </Dialog>
    </>
  )
}
