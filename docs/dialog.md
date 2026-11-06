# 通用 Dialog

播放器内的原生模态弹窗统一复用 `packages/player/src/components/Dialog/Dialog.tsx`；播放器内部从 `~/components/Dialog/Dialog` 导入，跨包从 `@m-part/player/dialog` 导入。不要在业务组件里重复编写 `<dialog>`、`showModal()` / `close()` 或通用标题与关闭按钮样式。

```tsx
import Dialog, { DialogBody, DialogFooter, DialogHeader } from '~/components/Dialog/Dialog'

<Dialog open={open()} onClose={() => setOpen(false)} aria-labelledby="example-title">
  <DialogHeader title="设置" titleId="example-title" onClose={() => setOpen(false)} />
  <DialogBody>
    <div class="grid gap-3">{/* 表单项或列表 */}</div>
  </DialogBody>
  <DialogFooter class="justify-end">{/* 原有操作按钮 */}</DialogFooter>
</Dialog>
```

- `open` 是受控状态，`onClose` 负责更新该状态。Escape 和原生关闭事件统一通知调用方；父组件主动关闭时不重复回调，组件卸载时释放原生模态状态。焦点约束和焦点恢复由浏览器负责，关闭前也会收起内部 popover。
- 点击弹窗外部默认触发 `onClose`。传 `closeOnOutsideClick={false}` 可关闭此行为，Escape 仍可关闭弹窗。支持原生 `closedby` 的浏览器负责外部点击；旧浏览器通过同一次指针按下和抬起的位置判断。[HTMLDialogElement.closedBy](https://developer.mozilla.org/en-US/docs/Web/API/HTMLDialogElement/closedBy)
- `size` 可选 `sm` / `md` / `lg`，对应最大宽度 28 / 32 / 42rem，默认 `sm`。普通弹窗用 fixed + translate 居中，视口四周至少保留 16px；仅 `DialogBody` 滚动，标题与已有底部操作区不收缩。
- `DialogHeader` 的 `titleId` 与根节点 `aria-labelledby` 对应；可用 `description` / `descriptionId` 以及根节点 `aria-describedby` 关联说明。各弹窗应使用不同的 ID。
- 关闭按钮仅出现在标题右上角，图标距离顶部和右侧内容边缘均为 16px，24px 点击区域向外延伸，不额外挤占标题高度。按钮固定 `type="button"`，不会误提交表单。
- 表单可以放在根节点内部，用 `min-h-0 flex flex-col` 包裹标题、正文和底部操作区，保证 submit 按钮属于同一表单。底部操作由业务显式提供；没有操作时省略 `DialogFooter`，不要默认添加底部关闭按钮。
- `fullScreen` 用于展开播放器等自定义全屏布局：复用原生生命周期，内容布局、标题与 CSS 动画由业务提供。`ref` 返回原生元素供音质、菜单等浮层挂载；`class`、`id`、ARIA 与 `onKeyDown` 透传到根元素。
- 分段选择首次查询时保持关闭，多段结果或错误出现后才打开；重试期间保持已打开的状态，避免通用受控开关重新引入单段曲目的弹窗闪现。

验证包含受控开关、Escape、原生关闭与迟到事件、表单提交、ARIA 更新、卸载和内部 popover 清理；实际浏览器还需检查焦点恢复、窄屏及横屏长列表的单滚动区域，以及全屏播放器的退场动画。
