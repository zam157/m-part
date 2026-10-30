import ProviderImage from '~/components/ProviderImage/ProviderImage'
import type { AlbumInfo, ArtistInfo, MusicInfo } from '@m-part/music/types/music-info'
import type { Pagination as PaginationType, ProviderName } from '@m-part/music/types/provider'
import { errorMessage } from '../../../utils/index'
import { providers } from '@m-part/music/providers'
import { useNavigate, useParams } from '@solidjs/router'
import { clsx } from 'cn/lite'
import { createSignal, For, Match, Show, Switch } from 'solid-js'
import ErrorMessage from '~/components/ErrorMessage/ErrorMessage'
import MusicContextMenu from '~/components/MusicContextMenu/MusicContextMenu'
import Pagination from '~/components/Pagination/Pagination'
import TabContent from '~/components/Tabs/TabContent'
import Tabs from '~/components/Tabs/Tabs'
import { setPlayQueue } from '~/composables/player'

type TabValue = 'music' | 'albums'

interface ArtistDetailViewProps {
  provider: ProviderName
  id: string
}

/**
 * 路由参数是响应式的，在渲染期直接读 `params.provider` / `params.id` 会触发
 * STRICT_READ_UNTRACKED：那样拿到的是挂载时的快照，参数变了页面也不会跟着变。
 *
 * 改成交给 `keyed` 的 `<Show>`：它在追踪作用域里读参数，并把**原始值**（不是
 * accessor）传给子节点，参数一变就重建整块（等价于重新挂载），详情数据随之重新拉取。
 */
export default function ArtistDetailPage() {
  const params = useParams<{ provider: string, id: string }>()

  const routeParams = () => (params.provider && params.id
    ? { provider: params.provider as ProviderName, id: params.id }
    : null)

  return (
    <Show when={routeParams()} keyed>
      {route => <ArtistDetailView provider={route.provider} id={route.id} />}
    </Show>
  )
}

function ArtistDetailView(props: ArtistDetailViewProps) {
  const navigate = useNavigate()

  const provider = props.provider
  const artistId = props.id
  const providerInstance = providers[provider]

  const [infoLoading, setInfoLoading] = createSignal(Boolean(providerInstance.getArtistInfo))
  const [infoError, setInfoError] = createSignal<string | null>(null)
  const [artistInfo, setArtistInfo] = createSignal<ArtistInfo | null>(null)

  const [worksLoading, setWorksLoading] = createSignal(Boolean(providerInstance.getArtistWorks))
  const [worksError, setWorksError] = createSignal<string | null>(null)
  const [works, setWorks] = createSignal<MusicInfo[]>([])
  const [worksPagination, setWorksPagination] = createSignal<PaginationType>({
    page: 1,
    total: 0,
    pageSize: 20,
  })

  const [albumsLoading, setAlbumsLoading] = createSignal(false)
  const [albumsError, setAlbumsError] = createSignal<string | null>(null)
  const [albums, setAlbums] = createSignal<AlbumInfo[]>([])
  const [albumsPagination, setAlbumsPagination] = createSignal<PaginationType>({
    page: 1,
    total: 0,
    pageSize: 20,
  })

  const [activeTab, setActiveTab] = createSignal<TabValue>('music')

  const tabs = ([
    { value: 'music', label: '单曲' },
    { value: 'albums', label: '专辑' },
  ] satisfies { value: TabValue, label: string }[])
    .map((tab) => {
      if (tab.value === 'albums' && !providerInstance.getArtistAlbums) {
        return { ...tab, disabled: true }
      }
      if (tab.value === 'music' && !providerInstance.getArtistWorks) {
        return { ...tab, disabled: true }
      }
      return tab
    })

  // 三条数据各自的失败原因：出错时既要结束 loading，也要把原因留在页面上，
  // 否则请求挂掉和「确实没有数据」在界面上长得一模一样（还会永久停在骨架上）
  //
  // ⚠️ `getArtistInfo` / `getArtistWorks` 是在渲染期直接调用的，而 Solid 2 禁止在
  // owned scope（组件/计算体）内写信号（REACTIVE_WRITE_IN_OWNED_SCOPE，直接抛错）。
  // 所以这里的每个 set 都必须等一次 await 之后才执行；loading 的初值也改由
  // provider 能力推导，免得要在渲染期补写。
  async function getArtistInfo() {
    if (!providerInstance.getArtistInfo)
      return
    try {
      setArtistInfo(await providerInstance.getArtistInfo(artistId))
      setInfoError(null)
    }
    catch (error) {
      console.error('Failed to load artist info:', error)
      setInfoError(errorMessage(error))
    }
    finally {
      setInfoLoading(false)
    }
  }

  async function getArtistWorks(page: number) {
    if (!providerInstance.getArtistWorks)
      return
    try {
      const [items, pageData] = await providerInstance.getArtistWorks(artistId, page)
      setWorks(items)
      setWorksPagination(pageData)
      setWorksError(null)
    }
    catch (error) {
      console.error('Failed to load artist works:', error)
      setWorksError(errorMessage(error))
    }
    finally {
      setWorksLoading(false)
    }
  }

  // 只在事件里调用，不经过渲染期，但同样把 set 放在 await 之后以保持一致
  async function getArtistAlbums(page: number) {
    if (!providerInstance.getArtistAlbums)
      return
    setAlbumsLoading(true)
    try {
      const [items, pageData] = await providerInstance.getArtistAlbums(artistId, page)
      setAlbums(items)
      setAlbumsPagination(pageData)
      setAlbumsError(null)
    }
    catch (error) {
      console.error('Failed to load artist albums:', error)
      setAlbumsError(errorMessage(error))
    }
    finally {
      setAlbumsLoading(false)
    }
  }

  function handleTabChange(value: TabValue) {
    setActiveTab(value)
    // 上一轮失败的 tab，切回来时自动重试，不用先点「重试」
    if (value === 'music' && (worksLoading() || worksError())) {
      getArtistWorks(1)
    }
    else if (value === 'albums' && !albums().length) {
      getArtistAlbums(1)
    }
  }

  function handleAlbumClick(album: AlbumInfo) {
    let targetUrl = `/album-detail/${provider}/${album.id}`
    if (album.extra) {
      const query = new URLSearchParams({
        ...album.extra,
        artist: artistInfo()?.name || '',
      } as Record<string, string>).toString()
      targetUrl += `?${query}`
    }
    navigate(targetUrl)
  }

  getArtistInfo()
  getArtistWorks(1)

  return (
    <div class="flex-1 min-w-0 flex flex-col gap-3 p-4">
      <div class="grow-0 h-32 shrink-0 flex items-center gap-4">
        <Show
          when={!infoError()}
          fallback={(
            <ErrorMessage
              class="h-full"
              message={infoError() ?? ''}
              onRetry={getArtistInfo}
            />
          )}
        >
          <Show
            when={!infoLoading()}
            fallback={<div class="skeleton h-full aspect-square object-cover rounded" />}
          >
            <ProviderImage
              provider={props.provider} usage="detail"
              src={artistInfo()?.coverUrl}
              referrerpolicy="no-referrer"
              alt="Artist Avatar"
              class="h-full aspect-square object-cover rounded-lg"
            />
          </Show>
          <div class="flex flex-col gap-1">
            <div class={clsx('text-xl font-bold', infoLoading() && 'skeleton w-16 h-[1em]')}>
              {artistInfo()?.name}
            </div>
            <div class={clsx('text-sm text-muted-foreground', infoLoading() && 'skeleton w-24 h-[1em]')}>
              {artistInfo()?.description}
            </div>
            <div class={activeTab() === 'music' ? 'visible' : 'invisible'}>
              <Show when={worksLoading()}>
                <div class="skeleton w-24 h-8 mt-2" />
              </Show>
              <Show when={!worksLoading() && works().length}>
                <button
                  class="btn px-3 py-1 mt-2 w-24"
                  onClick={() => setPlayQueue(works())}
                >
                  播放全部
                </button>
              </Show>
            </div>
          </div>
        </Show>
      </div>

      <Tabs class="grow-0" tabs={tabs} modelValue={activeTab()} onModelValueChange={handleTabChange}>
        <TabContent value="music" class="flex-1 min-h-0 overflow-auto flex flex-col gap-1 pb-2">
          <Switch
            fallback={(
              <div class="empty">
                <span class="i-solar:music-notes-bold text-4xl text-foreground/20 mb-2" />
                <span class="text-foreground/30">暂无单曲</span>
              </div>
            )}
          >
            <Match when={worksError()}>
              <ErrorMessage
                message={worksError() ?? ''}
                onRetry={() => getArtistWorks(worksPagination().page)}
              />
            </Match>

            <Match when={worksLoading()}>
              <For each={[1, 2, 3, 4, 5, 6]}>
                {i => (
                  <div class="flex items-center gap-2 p-1.5 h-12">
                    <div class="skeleton h-10 aspect-square object-cover rounded-lg shrink-0" />
                    <div class="flex flex-col flex-1 min-w-0 gap-2">
                      <div class="text-sm font-medium truncate skeleton h-[1em] w-[6em]" />
                      <div class="text-xs text-muted-foreground truncate skeleton h-[1em] w-[12em]" />
                    </div>
                  </div>
                )}
              </For>
            </Match>

            <Match when={works().length}>
              <For each={works()}>
                {work => (
                  <MusicContextMenu music={work}>{trigger => (
                    <div {...trigger} class="ghost-btn flex items-center gap-2 p-1.5 h-12">
                      <ProviderImage
                        provider={work.provider} usage="list"
                        src={work.coverUrl}
                        referrerpolicy="no-referrer"
                        alt="Work Cover"
                        class="h-10 aspect-square object-cover rounded-lg shrink-0"
                      />
                      <div class="flex flex-col flex-1 min-w-0">
                        <div class="text-sm font-medium w-full truncate min-h-1em">
                          {work.title}
                        </div>
                        <div class="text-xs text-muted-foreground w-full truncate min-h-1em">
                          {work.description}
                        </div>
                      </div>
                    </div>
                  )}</MusicContextMenu>
                )}
              </For>
              <Pagination
                modelValue={worksPagination().page}
                total={worksPagination().total}
                pageSize={worksPagination().pageSize}
                onPageChange={getArtistWorks}
              />
            </Match>
          </Switch>
        </TabContent>

        <Show when={providerInstance.getArtistAlbums}>
          <TabContent value="albums" class="flex-1 min-h-0 overflow-auto flex flex-col gap-1 pb-2">
            <Switch
              fallback={(
                <div class="empty">
                  <span class="i-solar:music-notes-bold text-4xl text-foreground/20 mb-2" />
                  <span class="text-foreground/30">暂无专辑</span>
                </div>
              )}
            >
              <Match when={albumsError()}>
                <ErrorMessage
                  message={albumsError() ?? ''}
                  onRetry={() => getArtistAlbums(albumsPagination().page)}
                />
              </Match>

              <Match when={albumsLoading()}>
                <For each={[1, 2, 3, 4]}>
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

              <Match when={albums().length}>
                <For each={albums()}>
                  {album => (
                    <div
                      class="ghost-btn flex items-center gap-2 p-1.5 h-12"
                      onClick={() => handleAlbumClick(album)}
                    >
                      <ProviderImage
                        provider={album.provider} usage="list"
                        src={album.coverUrl}
                        referrerpolicy="no-referrer"
                        alt="Album Cover"
                        class="h-10 aspect-square object-cover rounded-lg shrink-0"
                      />
                      <div class="flex flex-col gap-0.5 flex-1 min-w-0">
                        <div class="text-sm font-medium w-full truncate min-h-1em">
                          {album.title}
                        </div>
                        <div class="text-xs text-muted-foreground w-full truncate min-h-1em">
                          {album.description}
                        </div>
                      </div>
                    </div>
                  )}
                </For>
                <Pagination
                  modelValue={albumsPagination().page}
                  total={albumsPagination().total}
                  pageSize={albumsPagination().pageSize}
                  onPageChange={getArtistAlbums}
                />
              </Match>
            </Switch>
          </TabContent>
        </Show>
      </Tabs>
    </div>
  )
}
