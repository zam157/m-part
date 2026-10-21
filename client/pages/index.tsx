import { useNavigate } from '@solidjs/router'
import { For } from 'solid-js'
import { clsx } from 'cn/lite'
import { setKeyword, setSelectedType } from '~/composables/search'

const moods = [
  { title: '专注时刻', keyword: 'Lo-fi', description: '让节奏轻一点，让思绪走远一点。', icon: 'i-lucide:headphones', style: 'bg-[#e4e8e1] text-[#52614d]', tag: 'LO-FI / BEATS' },
  { title: '现场之间', keyword: '音乐现场', description: '把耳机戴好，留一个位置给现场。', icon: 'i-lucide:mic-vocal', style: 'bg-[#e8e1db] text-[#7e6454]', tag: 'LIVE / SESSIONS' },
  { title: '慢下来', keyword: '爵士音乐', description: '不赶时间，听完这一首再说。', icon: 'i-lucide:coffee', style: 'bg-[#dfe5e9] text-[#526977]', tag: 'JAZZ / CHILL' },
]

export default function IndexPage() {
  const navigate = useNavigate()
  function explore(keyword: string) {
    setKeyword(keyword)
    setSelectedType('music')
    navigate('/search')
  }
  return (
    <div class="flex-1 min-w-0 overflow-auto">
      <header class="h-16 px-9 max-[760px]:px-4.5 border-b border-border flex items-center justify-between"><span class="text-sm text-muted-foreground">你的音乐空间</span></header>
      <div class="max-w-[1240px] mx-auto px-10 pt-9 pb-6 max-[1100px]:p-7 max-[760px]:px-4.5 max-[760px]:py-6">
        <div class="flex items-center justify-between gap-4 mb-6"><div><h1 class="page-title">开始聆听</h1><p class="page-description">熟悉的旋律，或是下一次偶然发现。</p></div><span class="text-xs text-muted-foreground max-[760px]:hidden">MUSIC PARTY / 01</span></div>
        <section class="flex items-center justify-between min-h-[330px] px-11 py-9 bg-muted overflow-hidden border border-border rounded-xl max-[1100px]:p-7 max-[760px]:min-h-75">
          <div class="z-1 shrink-0">
            <span class="text-[11px] tracking-[2px] text-muted-foreground">留一点时间给音乐</span>
            <h2 class="text-[clamp(30px,3vw,42px)] font-[650] tracking-[-1.5px] leading-[1.35] mt-4.5 mb-3.5">找到你的<br />下一首单曲。</h2>
            <p class="text-[13px] leading-[1.9] text-muted-foreground">搜索喜欢的音乐和创作者，<br />把值得反复聆听的声音，放进播放队列。</p>
            <button class="btn h-10 px-5 mt-6" onClick={() => navigate('/search')}><span class="i-lucide:search text-4" />发现音乐<span class="i-lucide:arrow-up-right text-4 ml-3" /></button>
          </div>
          <div class="relative w-90 h-67.5 ml-10 mr-6.25 shrink-0 max-[1100px]:scale-80 max-[1100px]:origin-right max-[1100px]:-ml-8.75 max-[1100px]:mr-0 max-[1100px]:w-80 max-[760px]:hidden" aria-hidden="true">
            <div class="absolute z-1 left-0 top-2.25 h-62.5 w-59.5 bg-[#d6d5ce] text-[#30322f] p-6 -rotate-7 shadow-[0_16px_30px_#0002] flex flex-col justify-between">
              <span class="text-[9px] tracking-[2px]">MP / STEREO</span><strong class="text-[34px] leading-[1.4] tracking-[-1px]">声音<br />自有引力。</strong><small class="text-[8px] tracking-[1px]">PRESS PLAY. STAY AWHILE.</small>
            </div>
            <div class="size-63 rounded-full absolute top-3 -right-1.25 [background-image:repeating-radial-gradient(circle_at_center,#222_0px,#222_2px,#303030_3px,#202020_4px)] shadow-[8px_12px_22px_#0002] grid place-items-center"><div class="size-20.5 rounded-full bg-[#8a9282] text-[#e4e6de] grid place-items-center"><span class="i-lucide:audio-lines text-8" /></div></div>
          </div>
        </section>
        <div class="flex items-center justify-between gap-4 mt-8.5 mb-4.5"><div><h2 class="text-[19px] font-semibold tracking-[-0.5px]">今天，想听点什么？</h2><p class="page-description">选一个方向，开始探索。</p></div><span class="text-xs text-muted-foreground max-[760px]:hidden">搜索灵感</span></div>
        <div class="grid grid-cols-3 gap-5 max-[760px]:grid-cols-1">
          <For each={moods}>{mood => (
            <button class="overflow-hidden text-left transition-[transform,box-shadow] duration-200 bg-card hover:-translate-y-0.75 hover:shadow-[0_6px_18px_#0000000a] border border-border rounded-xl" onClick={() => explore(mood.keyword)}>
              <div class={clsx('h-33 max-[760px]:h-27.5 relative overflow-hidden', mood.style)}><span class="absolute top-4.5 left-5 text-[9px] tracking-[2px]">{mood.tag}</span><span class={clsx(mood.icon, 'absolute text-[74px] right-9.5 bottom-3.5 opacity-50 -rotate-12')} /><span class="absolute left-5 bottom-4.5 grid place-items-center border border-current rounded-full size-6.75 opacity-65"><span class="i-lucide:arrow-up-right text-4" /></span></div>
              <div class="py-4.5 px-5"><h3 class="text-[15px] font-semibold">{mood.title}</h3><p class="mt-1.5 text-[11px] leading-[1.7] text-muted-foreground">{mood.description}</p></div>
            </button>
          )}</For>
        </div>
        <div class="flex items-center justify-center gap-2.5 text-[11px] mt-7 text-muted-foreground"><span class="i-lucide:audio-lines text-4" /><span>从一首歌开始，让好声音慢慢排成队。</span></div>
      </div>
    </div>
  )
}
