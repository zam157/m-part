import { useNavigate } from '@solidjs/router'
import Recommendations from '~/components/Recommendations/Recommendations'

export default function IndexPage() {
  const navigate = useNavigate()
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
        <Recommendations source="bili" title="BiliBili · 音乐精选" description="从音乐分区榜单，发现值得一听的声音。" />
        <Recommendations source="netease" title="网易云 · 推荐新歌" description="听听新近发布的旋律，遇见下一首喜欢。" />
        <Recommendations source="qq" title="QQ音乐 · 推荐新歌" description="从新歌首发，发现新的旋律。" />
      </div>
    </div>
  )
}
