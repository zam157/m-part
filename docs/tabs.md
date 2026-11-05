# 通用 Tabs

新组件参考 [shadcn Tabs](https://ui.shadcn.com/docs/components/base/tabs) 的组合 API 与外观，使用 Solid 2 实现，不引入 React / Base UI 依赖，也不提供 RTL 功能。键盘默认行为参考 [Base UI Tabs](https://base-ui.com/react/components/tabs)：方向键移动焦点，Enter / Space 激活；`activateOnFocus` 可启用自动激活。

入口为 `packages/player/src/components/Tabs/index.ts`，实现位于 `primitives.tsx`。播放器内使用 `~/components/Tabs`，跨包使用 `@m-part/player/tabs`。

```tsx
import { Tabs, TabsList, TabsTrigger, TabsContent } from '~/components/Tabs'

<Tabs defaultValue="overview">
  <TabsList aria-label="统计视图">
    <TabsTrigger value="overview">概览</TabsTrigger>
    <TabsTrigger value="analytics">分析</TabsTrigger>
    <TabsTrigger value="settings" disabled>设置</TabsTrigger>
  </TabsList>
  <TabsContent value="overview">概览内容</TabsContent>
  <TabsContent value="analytics">分析内容</TabsContent>
  <TabsContent value="settings">设置内容</TabsContent>
</Tabs>
```

## 状态与交互

- `Tabs` 支持受控 `value` / `onValueChange`，或非受控 `defaultValue`；值可用字符串或数字，`null` 表示不选中任何项。`defaultValue` 只读取初始值；省略时，挂载后选择第一个可用项。
- 非受控选项被禁用或删除时自动回退；无可用项时回退为 `null`，重新添加可用项后恢复选择。回退在同一批注册更新完成后执行，按相同值重建列表不会意外重置选择。受控值始终由调用方决定。`onValueChange` 也会通知非受控状态的自动选择与回退。
- `TabsList` 默认 `loopFocus={true}`、`activateOnFocus={false}`。横向使用左右方向键，纵向使用上下方向键；Home / End 跳到首尾，禁用项会被跳过。Tab 保持原生焦点导航，离开列表后，下次进入优先聚焦当前选中项。
- 按钮固定 `type="button"`，不会提交父表单。每个列表应提供 `aria-label` 或 `aria-labelledby`；trigger / panel 的 ID 和 ARIA 关联由组件生成，每个 `TabsTrigger` 都应有相同 value 的 `TabsContent`。

## 外观与内容

- `TabsList variant="default"` 使用浅色圆角底和选中项背景，列表默认高度 32px；`variant="line"` 使用下划线，纵向时改为侧边指示线。
- `Tabs orientation="vertical"` 可改为纵向标签。方向会传递到列表、按钮和面板，触发器的 `children` 可直接传文字与图标。
- 所有组成部分支持 `class`，默认原子样式放在 UnoCSS components 层，调用方的普通工具类可覆盖默认布局。布局间距使用 `gap` / `padding`，不依赖 margin。
- `TabsContent` 默认只挂载激活面板的内容。需保留输入、内部状态或滚动位置时使用 `keepMounted`；隐藏面板保留 `hidden`、`inert` 和强制隐藏样式，不会因外部 `flex` / `grid` 类而意外显示。
- 提供 `data-slot`、`data-orientation`、`data-state` / `data-active`，列表另有 `data-variant`。不实现 React 的 `render` 替换元素接口或动画事件接口。

## 当前接入范围

本次只新增组件、导出、测试与文档，业务页面暂不接入，应用位置由用户决定。原来的 `Tabs/Tabs.tsx`、`TabContent.tsx` 与 `tabs-context.ts` 继续兼容已有歌手页；它们是旧数据式接口，不要与新组合 API 混用或在未迁移调用方时删除。

测试覆盖受控与非受控状态、默认选择、两种激活方式、方向和循环、禁用与动态增删、列表重建及重排、面板状态保留、嵌套、ARIA / ID、表单行为。浏览器检查两种外观、纵向布局和键盘导航；临时验证容器在验收后移除，不作为业务入口。
