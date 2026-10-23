# 右键菜单与添加到下一首

歌曲右键菜单接入首页推荐、搜索结果、歌手单曲、专辑曲目、歌单详情和播放队列，两个音源共用同一套实现。外观沿用 [shadcn Context Menu](https://ui.shadcn.com/docs/components/context-menu) 的主题色、圆角、边框、间距与焦点样式。

## 组件使用

`ContextMenuHost` 在 `App.tsx` 挂载一次，通过 Portal 和原生 Popover 显示唯一菜单。每行的 `ContextMenu` 只提供事件与无障碍属性，不增加 DOM 包装，也不逐行创建浮层或全局监听。

```tsx
<ContextMenu
  label="操作菜单"
  getItems={() => [{ id: 'action', label: '操作', icon: 'i-lucide:check', onSelect: handleAction }]}
>
  {trigger => <div {...trigger}>右键目标</div>}
</ContextMenu>
```

将 `trigger` 展开到实际目标上；同名事件要自行组合，避免覆盖。`getItems` 在打开时读取，支持 `disabled`、`destructive`、`separatorBefore`、`shortcut`；`shortcut` 只显示提示，不注册快捷键。列表和推荐中的歌曲使用 `MusicContextMenu`，传入 `music` 即可复用“添加到下一首”。播放队列中的歌曲直接使用 `ContextMenu`，只提供“从队列中移除”；原侧栏与展开页浮窗共用此行为。

右键使用指针坐标，Shift+F10 / ContextMenu 键使用目标底部坐标，自动限制在视口内；这里使用显式坐标定位，不依赖 Popover 隐式锚点。方向键、Home / End 跳过禁用项；Enter / Space 执行；Escape / Tab 关闭并恢复来源焦点。点击外部、页面滚动、窗口缩放或来源卸载会关闭；菜单内部滚动不关闭。

菜单使用 `popover="manual"`，外部关闭监听后续的 `pointerdown`。不要改回 `auto`：Chrome 会在 `contextmenu` 打开浮层后，于同一次右键释放时触发原生 light-dismiss，导致菜单一闪即逝。仅用脚本派发 `contextmenu` 无法发现此问题，必须验证完整的右键按下与释放。

## 队列语义

`packages/player/src/composables/player.ts` 的 `addNextToPlayQueue(music)` 是通用入口，不需要新增 Provider 接口，也不会预先请求歌曲的音频地址：

- 有当前曲目时，把目标放在其后；保持当前音频、进度、暂停状态及播放模式。
- 队列已有该歌曲时移动原有条目，按 `provider + id` 去重；当前歌曲自身不操作，菜单中禁用。
- 随机模式同时重映射队列索引并调整实际随机顺序，让手动或正常自动切歌时下一首为指定歌曲。单曲循环仍遵循原来的循环规则。
- 连续添加时，最后添加的歌曲排在紧接当前曲目的位置。
- 空队列或没有有效当前曲目时，沿用 `addToPlayQueue` 直接播放。

## 验证

客户端测试覆盖队列移动与索引、不同音源相同 ID、随机顺序、空队列、音频与进度不受影响，以及菜单的键盘操作、禁用项、滚动关闭、卸载清理和边界定位。

扩展中实际右键歌曲，检查打开菜单不会触发左键播放；执行后当前曲目持续播放，点击下一首进入目标。还应检查当前曲目的禁用状态、队列中的重复歌曲移动、窗口右下角定位、外部点击和键盘关闭，以及跨断点缩放后的控制台。
