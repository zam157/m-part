import { useNavigate } from '@solidjs/router'
import Recommendations from '~/components/Recommendations/Recommendations'

export default function IndexPage() {
  const navigate = useNavigate()
  return (
    <div class="flex-1 min-w-0 overflow-auto">
      <header class="h-16 px-9 max-[760px]:px-4.5 border-b border-border flex items-center justify-between"><span class="text-sm text-muted-foreground">Music Party</span></header>
      <div class="px-10 pt-9 pb-6 max-[1100px]:p-7 max-[760px]:px-4.5 max-[760px]:py-6">
        <div class="flex items-center justify-between gap-4 mb-6"><div><h1 class="page-title">首页</h1></div><span class="text-xs text-muted-foreground max-[760px]:hidden">MUSIC PARTY / 01</span></div>
        <section class="flex items-center justify-between min-h-[330px] px-11 py-9 bg-muted overflow-hidden border border-border rounded-xl max-[1100px]:p-7 max-[760px]:min-h-75">
          <div class="z-1 shrink-0">
            <span class="text-[11px] tracking-[2px] text-muted-foreground">多音源音乐播放器</span>
            <h2 class="text-[clamp(30px,3vw,42px)] font-[650] tracking-[-1.5px] leading-[1.35] mt-4.5 mb-3.5">搜索音乐</h2>
            <p class="text-[13px] leading-[1.9] text-muted-foreground">搜索歌曲、创作者、专辑和歌单，<br />将歌曲添加到播放队列。</p>
            <button class="btn h-10 px-5 mt-6" onClick={() => navigate('/search')}><span class="i-lucide:search text-4" />搜索<span class="i-lucide:arrow-up-right text-4 ml-3" /></button>
          </div>
          <div class="relative w-90 h-67.5 ml-10 mr-6.25 shrink-0 max-[1100px]:scale-80 max-[1100px]:origin-right max-[1100px]:-ml-8.75 max-[1100px]:mr-0 max-[1100px]:w-80 max-[760px]:hidden" aria-hidden="true">
            <div class="absolute z-1 left-0 top-2.25 h-62.5 w-59.5 bg-[#d6d5ce] text-[#30322f] p-6 -rotate-7 shadow-[0_16px_30px_#0002] flex flex-col justify-between">
              <span class="text-[9px] tracking-[2px]">MP / STEREO</span><strong class="text-[34px] leading-[1.4] tracking-[-1px]">MUSIC<br />PARTY</strong><small class="text-[8px] tracking-[1px]">MUSIC PLAYER</small>
            </div>
            <div class="size-63 rounded-full absolute top-3 -right-1.25 [background-image:repeating-radial-gradient(circle_at_center,#222_0px,#222_2px,#303030_3px,#202020_4px)] shadow-[8px_12px_22px_#0002] grid place-items-center"><div class="size-20.5 rounded-full bg-[#8a9282] text-[#e4e6de] grid place-items-center"><span class="i-lucide:audio-lines text-8" /></div></div>
          </div>
        </section>
        <Recommendations source="bili" title="BiliBili · 音乐精选" description="BiliBili 音乐分区榜单" />
        <Recommendations source="netease" title="网易云 · 推荐新歌" description="网易云音乐新歌推荐" />
        <Recommendations source="qq" title="QQ音乐 · 推荐新歌" description="QQ 音乐新歌首发" />
      </div>
    </div>
  )
}
