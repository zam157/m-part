import { useNavigate } from '@solidjs/router'
import { For } from 'solid-js'
import { clsx } from 'cn/lite'
import { setKeyword, setSelectedType } from '~/composables/search'

const moods = [
  { title: '专注时刻', keyword: 'Lo-fi', description: '让节奏轻一点，让思绪走远一点。', icon: 'i-lucide:headphones', style: 'mood-focus', tag: 'LO-FI / BEATS' },
  { title: '现场之间', keyword: '音乐现场', description: '把耳机戴好，留一个位置给现场。', icon: 'i-lucide:mic-vocal', style: 'mood-live', tag: 'LIVE / SESSIONS' },
  { title: '慢下来', keyword: '爵士音乐', description: '不赶时间，听完这一首再说。', icon: 'i-lucide:coffee', style: 'mood-slow', tag: 'JAZZ / CHILL' },
]

export default function IndexPage() {
  const navigate = useNavigate()
  function explore(keyword: string) {
    setKeyword(keyword)
    setSelectedType('music')
    navigate('/search')
  }
  return (
    <div class="home-page page-scroll">
      <header class="page-topbar"><span class="text-sm text-muted-foreground">你的音乐空间</span></header>
      <div class="home-content">
        <div class="section-heading"><div><h1>开始聆听</h1><p>熟悉的旋律，或是下一次偶然发现。</p></div><span class="text-xs text-muted-foreground">MUSIC PARTY / 01</span></div>
        <section class="listening-hero border border-border rounded-xl">
          <div class="hero-copy">
            <span class="hero-eyebrow text-muted-foreground">留一点时间给音乐</span>
            <h2>找到你的<br />下一首单曲。</h2>
            <p class="text-muted-foreground">搜索喜欢的音乐和创作者，<br />把值得反复聆听的声音，放进播放队列。</p>
            <button class="btn h-10 px-5 mt-6" onClick={() => navigate('/search')}><span class="i-lucide:search text-4" />发现音乐<span class="i-lucide:arrow-up-right text-4 ml-3" /></button>
          </div>
          <div class="record-art" aria-hidden="true"><div class="record-sleeve"><span>MP / STEREO</span><strong>声音<br />自有引力。</strong><small>PRESS PLAY. STAY AWHILE.</small></div><div class="vinyl"><div class="vinyl-label"><span class="i-lucide:audio-lines text-8" /></div></div></div>
        </section>
        <div class="section-heading mood-heading"><div><h2>今天，想听点什么？</h2><p>选一个方向，开始探索。</p></div><span class="text-xs text-muted-foreground">搜索灵感</span></div>
        <div class="mood-grid">
          <For each={moods}>{mood => (
            <button class="mood-card border border-border rounded-xl" onClick={() => explore(mood.keyword)}>
              <div class={clsx('mood-art', mood.style)}><span class="mood-tag">{mood.tag}</span><span class={clsx(mood.icon, 'mood-icon')} /><span class="mood-arrow"><span class="i-lucide:arrow-up-right text-4" /></span></div>
              <div class="mood-copy"><h3>{mood.title}</h3><p class="text-muted-foreground">{mood.description}</p></div>
            </button>
          )}</For>
        </div>
        <div class="home-note text-muted-foreground"><span class="i-lucide:audio-lines text-4" /><span>从一首歌开始，让好声音慢慢排成队。</span></div>
      </div>
    </div>
  )
}
