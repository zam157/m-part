import type { MusicInfo } from '#shared/types/music-info'
import type { Pagination as PaginationType, ProviderName } from '#shared/types/provider'
import { providers } from '#shared/utils/providers/index'
import { useParams, useSearchParams } from '@solidjs/router'
import { createSignal, For, Match, Show, Switch } from 'solid-js'
import Pagination from '~/components/Pagination/Pagination'
import { addToPlayQueue, setPlayQueue } from '~/composables/player'

/** useSearchParams 的值可能是数组，这里统一取单值 */
function queryValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value
}

export default function AlbumDetailPage() {
  const params = useParams<{ provider: string, id: string }>()
  const [searchParams] = useSearchParams()

  const provider = params.provider as ProviderName
  const albumId = params.id
  const providerInstance = providers[provider]
  const canLoadWorks = Boolean(providerInstance.getAlbumWorks)

  const [loading, setLoading] = createSignal(true)
  const [works, setWorks] = createSignal<MusicInfo[]>([])
  const [pagination, setPagination] = createSignal<PaginationType>({
    page: 1,
    total: 0,
    pageSize: 20,
  })

  async function getAlbumWorks(page: number) {
    if (!providerInstance.getAlbumWorks)
      return
    try {
      const [items, pageData] = await providerInstance.getAlbumWorks(albumId, page, searchParams)
      setWorks(items)
      setPagination(pageData)
    }
    finally {
      setLoading(false)
    }
  }

  function handlePlay(music: MusicInfo) {
    addToPlayQueue(music)
  }

  getAlbumWorks(1)

  return (
    <div class="flex-1 min-w-0 flex flex-col gap-3 p-4">
      {/* Album Info */}
      <div class="grow-0 h-32 shrink-0 flex items-center gap-4">
        <Show when={queryValue(searchParams.cover)}>
          <img
            src={queryValue(searchParams.cover)}
            referrerpolicy="no-referrer"
            alt="Album Cover"
            class="h-full aspect-square object-cover rounded-lg"
          />
        </Show>
        <div class="flex flex-col gap-1">
          <div class="text-xl font-bold">
            {queryValue(searchParams.title) || '未知专辑'}
          </div>
          <div class="text-sm text-muted-foreground">
            {queryValue(searchParams.artist) || '未知艺术家'}
          </div>
          <Show when={!loading() && works().length} fallback={
            <Show when={loading()}>
              <div class="skeleton w-24 h-8 mt-2" />
            </Show>
          }
          >
            <button
              class="btn px-3 py-1 mt-2 w-24"
              onClick={() => setPlayQueue(works())}
            >
              播放全部
            </button>
          </Show>
        </div>
      </div>

      {/* Track List */}
      <div class="flex-1 min-h-0 overflow-auto grid gap-x-2 gap-y-1 responsive-cols grid-auto-rows-max content-start pb-2">
        <Switch
          fallback={(
            <div class="empty col-span-full">
              <span class="i-solar:music-notes-bold text-4xl text-foreground/20 mb-2" />
              <span class="text-foreground/30">暂无曲目</span>
            </div>
          )}
        >
          <Match when={!canLoadWorks}>
            <div class="empty col-span-full">
              <span class="i-solar:danger-circle-bold text-4xl text-foreground/20 mb-2" />
              <span class="text-foreground/30">当前音源不支持专辑</span>
            </div>
          </Match>

          <Match when={loading()}>
            <For each={[1, 2, 3, 4, 5, 6]}>
              {i => (
                <div class="flex items-center gap-2 p-1.5 h-12">
                  <div class="skeleton h-10 aspect-square rounded-lg shrink-0" />
                  <div class="flex flex-col flex-1 min-w-0 gap-2">
                    <div class="skeleton h-[1em] w-[6em]" />
                    <div class="skeleton h-[1em] w-[12em]" />
                  </div>
                </div>
              )}
            </For>
          </Match>

          <Match when={works().length}>
            <For each={works()}>
              {work => (
                <div
                  class="ghost-btn flex items-center gap-2 p-1.5 h-12"
                  onClick={() => handlePlay(work)}
                >
                  <img
                    src={work.coverUrl}
                    referrerpolicy="no-referrer"
                    alt="Track Cover"
                    class="h-10 aspect-square object-cover rounded-lg shrink-0"
                  />
                  <div class="flex flex-col flex-1 min-w-0">
                    <div class="text-sm font-medium w-full truncate min-h-1em">
                      {work.title}
                    </div>
                    <div class="text-xs text-muted-foreground w-full truncate min-h-1em">
                      {work.artist}
                    </div>
                  </div>
                </div>
              )}
            </For>
            <Pagination
              class="col-span-full"
              modelValue={pagination().page}
              total={pagination().total}
              pageSize={pagination().pageSize}
              onPageChange={getAlbumWorks}
            />
          </Match>
        </Switch>
      </div>
    </div>
  )
}
