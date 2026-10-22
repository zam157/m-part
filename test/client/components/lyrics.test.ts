import { createComponent, render } from '@solidjs/web'
import { createSignal, flush } from 'solid-js'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import Lyrics from '~/components/Lyrics/Lyrics'
const { getLyrics } = vi.hoisted(() => ({ getLyrics: vi.fn() }))
vi.mock('#shared/utils/constants', () => ({ TARGET_EXTENSION: true }))
vi.mock('#shared/utils/providers', () => ({ providers: { netease: { getLyrics }, bili: {} } }))
const player = await import('~/composables/player')
let container: HTMLDivElement
let dispose: (() => void) | undefined
let scrollDescriptor: PropertyDescriptor | undefined
let serial = 0
beforeEach(async () => {
  vi.spyOn(player.audio, 'load').mockImplementation(() => {})
  vi.spyOn(player.audio, 'pause').mockImplementation(() => {})
  vi.spyOn(player.audio, 'play').mockResolvedValue()
  scrollDescriptor = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'scrollTo')
  Object.defineProperty(HTMLElement.prototype, 'scrollTo', { configurable: true, value: vi.fn() })
  getLyrics.mockReset().mockResolvedValue({ original: '[00:05]Hello\n[00:10]World', translated: '[00:10]世界' })
  await player.setPlayQueue([{ provider: 'netease', id: `ui-lyrics-${++serial}`, title: 'Song', coverUrl: '', duration: 60, src: 'https://cdn.example/song.mp3' }])
  player.audio.dispatchEvent(new Event('pause'))
  vi.mocked(player.audio.play).mockClear()
  vi.spyOn(player.audio, 'duration', 'get').mockReturnValue(60)
  player.audio.dispatchEvent(new Event('durationchange'))
  player.setWaiting(false)
  player.setCurrentTime(6)
  flush()
  container = document.createElement('div')
  document.body.append(container)
})
afterEach(() => {
  dispose?.()
  container.remove()
  if (scrollDescriptor) Object.defineProperty(HTMLElement.prototype, 'scrollTo', scrollDescriptor)
  else Reflect.deleteProperty(HTMLElement.prototype, 'scrollTo')
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})
function renderLyrics() {
  dispose = render(() => createComponent(Lyrics, { visible: true }), container)
  flush()
}
async function mount() {
  renderLyrics()
  await vi.waitFor(() => expect(container.querySelectorAll('.lyric-line')).toHaveLength(2))
}

describe('歌词交互', () => {
  it('失败可重试为纯文本歌词，没有时间轴时不伪装成可跳转行', async () => {
    getLyrics.mockRejectedValueOnce(new Error('歌词加载超时')).mockResolvedValueOnce({ original: '没有时间轴的歌词' })
    renderLyrics()
    await vi.waitFor(() => expect(container.textContent).toContain('歌词加载超时'))
    ;([...container.querySelectorAll('button')].find(button => button.textContent === '重试')!).click()
    flush()
    await vi.waitFor(() => expect(container.textContent).toContain('没有时间轴的歌词'))
    expect(container.querySelectorAll('.lyric-line')).toHaveLength(0)
  })
  it('纯音乐与不支持歌词的音源分别显示提示', async () => {
    getLyrics.mockResolvedValueOnce({ original: '', instrumental: true })
    renderLyrics()
    await vi.waitFor(() => expect(container.textContent).toContain('纯音乐，请欣赏'))
    await player.setPlayQueue([{ provider: 'bili', id: 'no-lyrics', title: '视频', coverUrl: '', duration: 60, src: 'https://cdn.example/video.mp3' }])
    flush()
    expect(container.textContent).toContain('此音源暂不提供歌词')
    expect(getLyrics).toHaveBeenCalledTimes(1)
  })

  it('高亮随进度前后跳转；点击歌词只 seek，保留暂停状态', async () => {
    await mount()
    expect(container.querySelector('[aria-current="true"]')?.textContent).toContain('Hello')
    const target = container.querySelector<HTMLButtonElement>('[aria-label="跳转到 World"]')!
    target.click()
    flush()
    expect(player.currentTime()).toBe(10)
    expect(player.audio.play).not.toHaveBeenCalled()
    expect(container.querySelector('[aria-current="true"]')?.textContent).toContain('World')
    player.setCurrentTime(1)
    flush()
    expect(container.querySelector('[aria-current="true"]')).toBeNull()
    expect(getLyrics).toHaveBeenCalledTimes(1)
  })
  it('手动滚动暂停跟随，恢复按钮和翻译开关可用，加载中不允许 seek', async () => {
    await mount()
    container.querySelector('[aria-label="歌词内容"]')!.dispatchEvent(new WheelEvent('wheel'))
    flush()
    const follow = [...container.querySelectorAll('button')].find(button => button.textContent?.includes('回到当前歌词'))!
    expect(follow).toBeDefined()
    follow.click()
    flush()
    expect(container.textContent).not.toContain('回到当前歌词')
    container.querySelector<HTMLButtonElement>('[aria-label="显示翻译"]')!.click()
    flush()
    expect(container.textContent).not.toContain('世界')
    player.setWaiting(true)
    flush()
    expect(container.querySelector<HTMLButtonElement>('.lyric-line')!.disabled).toBe(true)
  })

  it('逐字高亮随暂停时的 seek 前进及倒退，原文、翻译与点击行跳转仍保留', async () => {
    getLyrics.mockResolvedValueOnce({ original: '[00:05]你好\n[00:10]世界', wordByWord: {
      original: '[5000,4000](5000,2000,0)你(7000,2000,0)好\n[10000,1000](10000,1000,0)世界', translated: '[00:05]Hello',
    } })
    await mount()
    const words = () => [...container.querySelectorAll<HTMLElement>('[aria-current="true"] .lyric-word')]
    expect(words().map(word => word.style.getPropertyValue('--word-progress'))).toEqual(['50%', '0%'])
    expect(container.textContent).toContain('Hello')
    player.setCurrentTime(8)
    flush()
    expect(words().map(word => word.style.getPropertyValue('--word-progress'))).toEqual(['100%', '50%'])
    player.setCurrentTime(5.5)
    flush()
    expect(words()[0]?.style.getPropertyValue('--word-progress')).toBe('25%')
    container.querySelector<HTMLButtonElement>('[aria-label="跳转到 世界"]')!.click()
    flush()
    expect(player.currentTime()).toBe(10)
    expect(player.audio.play).not.toHaveBeenCalled()
  })

  it('无逐字歌词及损坏的逐字歌词回退为原来的逐行高亮', async () => {
    getLyrics.mockResolvedValueOnce({ original: '[00:05]Hello\n[00:10]World', wordByWord: { original: 'invalid' } })
    await mount()
    expect(container.querySelectorAll('.lyric-word')).toHaveLength(0)
    expect(container.querySelector('[aria-current="true"]')?.textContent).toContain('Hello')
    player.setCurrentTime(10)
    flush()
    expect(container.querySelector('[aria-current="true"]')?.textContent).toContain('World')
  })

  it('普通 LRC 播放时不启动逐字动画', async () => {
    const request = vi.fn()
    vi.stubGlobal('requestAnimationFrame', request)
    await mount()
    player.audio.dispatchEvent(new Event('play'))
    flush()
    expect(request).not.toHaveBeenCalled()
    expect(container.querySelectorAll('.lyric-word')).toHaveLength(0)
  })

  it('逐帧读取真实音频时间，暂停、后台、收起和卸载均停止，普通 LRC 不启动动画', async () => {
    let nextFrame: FrameRequestCallback | undefined
    const request = vi.fn((callback: FrameRequestCallback) => { nextFrame = callback; return 1 })
    const cancel = vi.fn()
    vi.stubGlobal('requestAnimationFrame', request)
    vi.stubGlobal('cancelAnimationFrame', cancel)
    getLyrics.mockResolvedValueOnce({ original: '[00:05]Hello\n[00:10]World', wordByWord: { original: '[5000,4000](5000,4000,0)Hello\n[10000,1000](10000,1000,0)World' } })
    const [visible, setVisible] = createSignal(true)
    dispose = render(() => createComponent(Lyrics, { get visible() { return visible() } }), container)
    flush()
    await vi.waitFor(() => expect(container.querySelectorAll('.lyric-word')).toHaveLength(2))
    expect(request).not.toHaveBeenCalled()
    player.audio.currentTime = 6
    player.audio.dispatchEvent(new Event('play'))
    flush()
    expect(request).toHaveBeenCalledOnce()
    player.audio.currentTime = 7
    nextFrame!(0)
    flush()
    expect(container.querySelector<HTMLElement>('[aria-current="true"] .lyric-word')?.style.getPropertyValue('--word-progress')).toBe('50%')
    const visibility = vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden')
    document.dispatchEvent(new Event('visibilitychange'))
    expect(cancel).toHaveBeenCalledWith(1)
    request.mockClear()
    expect(request).not.toHaveBeenCalled()
    visibility.mockReturnValue('visible')
    document.dispatchEvent(new Event('visibilitychange'))
    expect(request).toHaveBeenCalledOnce()
    player.audio.dispatchEvent(new Event('pause'))
    flush()
    expect(cancel).toHaveBeenCalledWith(1)
    player.audio.dispatchEvent(new Event('play'))
    flush()
    request.mockClear()
    setVisible(false)
    flush()
    expect(cancel).toHaveBeenCalledWith(1)
    document.dispatchEvent(new Event('visibilitychange'))
    expect(request).not.toHaveBeenCalled()
    setVisible(true)
    flush()
    dispose!()
    dispose = undefined
    request.mockClear()
    document.dispatchEvent(new Event('visibilitychange'))
    expect(request).not.toHaveBeenCalled()
  })
})
