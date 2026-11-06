# 通用 Select

所有客户端单选下拉统一使用 `packages/player/src/components/Select/Select.tsx`，功能与样式参考 [shadcn Base Select](https://ui.shadcn.com/docs/components/base/select)。实现使用 Solid 2、原生 Popover 与 UnoCSS，不引入 React / Base UI 运行时。搜索音源与类型、平台歌单音源、Cookie 来源、普通 / 展开播放器的音质，以及同步实验页校正策略均共用该组件。

## 数据与状态

```tsx
import Select from '~/components/Select/Select'

<Select
  options={[
    { value: 'website', label: '网站 Cookie' },
    { value: 'manual', label: '手动 Cookie' },
  ]}
  value={mode()}
  onValueChange={setMode}
  aria-label="Cookie 来源"
  placeholder="选择来源"
/>
```

- 传 `value` 时为受控组件，等待调用方更新后才显示新值；异步保存失败时仍保留旧值。省略 `value` 时使用内部状态，可传 `defaultValue`。`onValueChange` 仅在有效值确实变化时触发，重复选择当前项只关闭浮层。
- `options` 支持普通项 `{ value, label, disabled? }` 和分组 `{ label, options }`，分组自动显示标题与分隔线。label 保持纯文本，用于类型定位与无障碍名称；复杂展示使用 `renderOption`，自定义按钮内容使用 `renderValue`。
- 泛型值按 `Object.is` 比较；对象值可传 `isValueEqual`。组件缓存选项声明，渲染、选中标记和选项 ID 共用同一份对象，不能分别读取会重新 `.map()` 的 props getter。
- `disabled` 禁用整体，项的 `disabled` 会被键盘跳过；`invalid` 显示无效状态。默认高度为 `h-8`（32px），与共享 `input` 样式一致；`size="sm"` 为 28px。普通表单直接使用默认高度，不再重复覆盖为 36 / 40px。属性包括 `id`、`aria-label`、`aria-labelledby`、`aria-describedby` 与 `dir`。

## 交互与布局

- 点击、Enter、Space 或方向键展开；方向键、Home / End、PageUp / PageDown 移动高亮，Enter / Space 确认。Tab 确认高亮并继续正常焦点导航，Escape 放弃导航并关闭。输入文字按标签前缀定位，重复同一字符轮换匹配项。键盘移动不提前修改选中值，也不会提交父表单。
- 使用 combobox / listbox / option 语义，DOM 焦点留在按钮上，通过 `aria-activedescendant` 指向高亮项，并只滚动内部列表。滚动箭头支持点击和悬停；窗口缩放及页面滚动时重新定位，监听器与计时器在关闭 / 卸载时清理。
- 默认尝试将选中项与按钮对齐；触摸操作或空间不足时回退到边缘定位。`alignItemWithTrigger={false}` 强制按边缘定位，`side`、`align`、`sideOffset` 控制方向、对齐与间隔，碰撞时翻转并限制在视口内。RTL 的 start / end 随方向反转。
- 原生 dialog 内会自动把浮层挂在该 dialog 中，也可以显式传 `portalMount`。音质按钮用 `triggerVariant="ghost"` 复用 `ghost-btn` 的居中与悬停样式，保留 36px 槽位，并用 `renderValue` 展示图标。
- `triggerClass` / `contentClass` 用 `cn/lite` 拼接。覆盖内置同类工具规则时使用明确的 `!`，例如 40px 筛选栏使用 `triggerClass="!h-10"`；不要依赖类名的文本先后顺序，也不要恢复各调用方的定位行内样式。
- 触发器默认不带投影，下拉浮层使用 `shadow-md`，保留边框与键盘焦点环。
- 搜索栏由外层容器统一提供边框、圆角和 focus-within 焦点环，内部两项 Select 与输入框去掉自身边框和阴影，仅由间隔容器画分隔线；窄屏输入框换到第二行，但仍共用同一个外框。不能依赖旧 btn-group 的 shortcut 层规则覆盖 Select 的默认工具类。

## 表单与跨入口复用

提供 `name` / `form` 时接入原生 FormData，`required` 接入原生有效性检查并将错误与焦点映射到可见按钮；form reset 恢复非受控默认值。对象表单值使用 `serializeValue` 指定序列化方式。组件内部唯一的隐藏原生 select 是表单桥接，不承担显示或浮层交互。业务页面不再自行写 select / option。

跨包入口通过 `@m-part/player/select` 导入；同步实验页使用此导出和共享 Solid / UnoCSS 构建插件。相关依赖仅是 `apps/rooms` 的开发依赖，正式房间服务不导入播放器 UI。

## 验证

组件测试覆盖受控 / 非受控值、默认值、禁用、分组、键盘与文字定位、动态选项实例、空列表关闭、原生浮层关闭同步、表单数据 / 重置 / 校验、对象值、外部表单以及 dialog 挂载；Cookie 表单测试验证来源切换失败不改变显示值，音质测试验证选中标记和回调。

实际扩展验证搜索筛选、Cookie 来源切换并恢复、390px 边界、61 项 RTL 分组长列表、方向键跳过禁用项、普通与展开播放器音质切换及 Escape 行为。长列表只滚动内部列表，不产生浮层外层滚动。
