# 样式与类名（UnoCSS + shadcn 预设）

## 类名合并：只用 `cn/lite` 的 `clsx`

```ts
import { clsx } from 'cn/lite'

class={clsx('ghost-btn flex px-2', isActive() && 'bg-accent', props.class)}
```

`cn/lite` 是 shadcn 的 `cn` 包的 lite 子路径，等价 `clsx/lite`：**只拼接、不做冲突消解**，且只保留字符串（数组 / 对象会被静默忽略）。调用点传的都是字符串、`cond && str` 或三元，够用。

**不要**换成 `cn` 的完整版（内部是 tailwind-merge）。它的消解表只认 Tailwind 类名，UnoCSS 的数字字号（`text-9` / `text-5` / `text-3.5` / `text-2.5` …）不在字号校验表里，会被归到**文字颜色**组；同一次调用里再有 `text-primary` 之类，后者胜出、字号被静默删掉：

```ts
cn('text-9 text-primary', 'i-solar:play-circle-bold')
// → 'text-primary i-solar:play-circle-bold'   ← text-9 没了
```

实测后果：播放按钮 36px → 12px、音量与播放模式图标 20px → 12px，页面上没有任何报错。如果哪天真要消解冲突，得先用 `createCn({ extend: { classGroups: … } })` 把数字字号补进 `font-size` 组 —— 那需要在项目里多一个模块，目前不做。

## 快捷方式（shortcut）与工具类的叠加

`uno.config.ts` 里的 shortcut（`btn` / `ghost-btn` / `border-btn` / `card` / `empty` / `skeleton` / `responsive-cols` …）会展开成一串工具类。本项目开启了 `outputToCssLayers`：shortcut 在 `shortcuts` 层，直接工具类在后面的 `default` 层，因此调用处的工具类可覆盖 shortcut 的默认值；同一层内仍需检查生成顺序与选择器优先级，不能依赖 class 字符串的先后顺序。

踩过的实例：`card` 曾自带 `w-full max-w-sm`，搜索页网格里每格超过 384px 时卡片被卡住、剩余宽度变成视觉 gap（容器宽度 > 约 2016px 才出现，很容易漏掉）。排查手法是直接看产物 CSS 里 shortcut 展开成了什么。

## 原子类优先与 CSS 的保留范围

- 布局、间距、字号、颜色和响应式状态直接写 UnoCSS 类；重复的组合放在 `uno.config.ts` 的 shortcuts（如 `sidebar-item`、`page-title`、`popover-surface`），不要再增加只负责这些属性的语义 CSS 类。
- 全局 CSS 只保留文档默认值和减少动画设置。组件 CSS 主要保留原生锚点、`@starting-style` 与 `display` / `overlay` 离散过渡等规则，避免迁移时丢失浮层定位或退场效果。
- 连续变化的进度、音量通过行内 CSS 自定义属性传值，宽高与定位使用 `w-[--progress-percent]` 等类，不动态拼接 UnoCSS 类名。
- 当前 `presetWind4` 会把 `bg-[repeating-radial-gradient(...)]` 解析成 `background-color`，导致渐变无效；使用 `[background-image:repeating-radial-gradient(...)]`。锚点名 `--thumb` 保留原生 CSS：`[anchor-name:--thumb]` 会被改写成 `anchor-name: var(--thumb)`。
- 迁移后检查实际生成的 CSS，并在宽屏、760px 以下以及浮层打开时验证；类型检查不会发现原子类没有生成或覆盖顺序不对。

## 搜索页结果网格

列数由「最小卡宽」反推，而这个下限跟着视口走（`responsive-cols` 快捷方式）：

```
grid-cols-[repeat(auto-fill,minmax(clamp(300px,15vw,360px),1fr))]
```

可用宽 ≈ 视口宽 − 216（`Sidebar` 的 `w-54`）− 32（`px-4`）时的实测列数：

| 视口 | 列数 | 卡片宽度 |
| --- | --- | --- |
| 1366 | 3 | ~362px |
| 1920 | 5 | ~322px |
| 2560 | 6 | ~372px |
| 3440 | 8 | ~385px |

- **别退回固定下限**（`minmax(200px,1fr)`）：超宽屏会一直加列，2560 宽排到 11 列 ~200px 的小卡片
- 用 `auto-fill` 而不是 `auto-fit`，否则结果很少时单张卡会被拉满整行
- 搜索页根节点上不再需要 `@container`（`container-type: inline-size` 带隐式 containment）

## 尺度

搜索栏是 `w-full max-w-2xl` + `h-10`，左缘与下方结果网格对齐。`btn-group` 里各段都是 `h-full`，改高度只改外层即可。`Select` 触发器文字用 `text-sm`，与输入框同一尺度（曾经是 `text-xs`：12px 的标签配 14px 的输入框，看着别扭）。

## 浮层（Popover）

- 定位优先用**隐式锚点**：`popovertarget` + `id` 已经把触发器和浮层关联起来，在 `popover.css` 里写 `position-anchor: auto` + `anchor()` / `anchor-center` 即可，不需要动态 `anchor-name`
- ⚠️ 命令式打开必须给来源：`showPopover({ source: triggerEl })` / `togglePopover({ source })`；不带 `source` 时隐式锚点丢失，浮层会掉到视口左上角（`PopoverApi` 里已处理）
- 退场动画的 `transition-property` 必须同时含 `display` 与 `overlay`，并配 `transition-behavior: allow-discrete`。漏掉 `overlay` 时元素在关闭瞬间就退出 top layer，淡出被下层内容盖住 → 表现为「瞬间消失」

## 两条不能动的构建约定

- `vite-shared.ts` 里的 `solid({ solid: { omitQuotes: false } })`：Solid 编译器默认省略「唯一属性」的引号（`class="empty"` → `class=empty`），编译产物里该 token 就无法被 UnoCSS 提取，单 token 的 class 会**静默丢样式**
- `unocss` 必须 ≥ 66.10：66.8.x 在 Vite 8 的多环境构建里找不到 `vite:css-post`（`[unocss] failed to find vite:css-post plugin`），生产 CSS 只剩 4 kB，工具类全丢
