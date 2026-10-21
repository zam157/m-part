# 展开播放器

点击底部播放栏的封面进入展开页，参考 [Apple Music 播放器](https://support.apple.com/guide/music/use-music-miniplayer-mus71d7dcfce/mac) 的大封面与播放控制布局，使用项目现有 shadcn 主题色、按钮、边框、圆角及浮层。

## 功能与布局

- 展示封面、标题、创作者、专辑、进度和播放控制；顶部队列按钮在所有屏幕尺寸打开右侧浮窗，不挤压主内容。浮窗直接复用 `PlayQueue`，原侧栏与浮窗共享 `QueueTracks`、列表间距、顶部留白和队列操作。原生 Popover 负责点击外部 / Esc 关闭。
- 支持播放 / 暂停、上一首 / 下一首、播放模式、拖动与键盘跳转进度、音量 / 静音、音质选择、播放错误及重试。
- 队列可选歌播放、移除、清空及使用右键“添加到下一首”。随机模式按真实的随机播放顺序显示。大队列按当前歌曲附近分批展示，“显示更多歌曲”可继续展开；不会默认额外创建整份大队列的 DOM。
- 展开 / 收起不操作 `Audio`，底栏和展开页共用 `client/composables/player.ts` 及 IndexedDB 缓存。音质切换保留进度与原播放 / 暂停状态；移除最后一首或清空队列时自动收起。

## 动画与交互约定

`ExpandedPlayer.tsx` 使用原生 `dialog.showModal()` / `close()`，浏览器负责背景 inert、焦点约束和焦点返回；Esc 或收起按钮更新同一个受控开关。空白区域按 Space 切换播放，按钮和滑块保留原生键盘行为。

`expanded-player.css` 负责全部开合动画：`@starting-style` 定义起点，`transform` / `opacity` 负责展开，`display` / `overlay` 的 `allow-discrete` 过渡保留完整退场。不要用条件渲染卸载对话框内容，也不要用定时器、逐帧 JS 或动画期间的布局测量替代它。`prefers-reduced-motion: reduce` 关闭过渡。不支持这些新 CSS 特性的浏览器仍可正常开关，只是动画会降级。原生机制参考 [MDN dialog 过渡](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/dialog#animating_dialogs)。

共享组件：

- `PlaybackControls` / `PlaybackProgress` 同时用于底栏和展开页；进度手势保留同步局部变量，不能改成 Solid 2 写完立刻回读的 signal。
- `VolumeSlider` 的 `expanded` 形态填满容器；音质及播放重试动作集中在 `player-controls.ts`。
- 图标类名字面量放在 `.tsx` 中，确保 UnoCSS 默认扫描能提取。新增组件后需要实际检查开发与生产 CSS，不能仅凭类型检查判断样式已生成。

## 对话框内的浮层

`Popover`、`Tooltip` 和 `QualityBtn` 通过 `portalMount` 将浮层挂到所属 dialog 内。共享 `ContextMenuHost` 按当前来源的 `closest('dialog')` 自动选择 Portal 容器。**不能统一挂回 body**：模态对话框外的节点是 inert，菜单即使显示，也可能无法点击或获取焦点。

收起对话框前关闭其内部 Popover，避免浮层脱离界面残留；仅关闭右键菜单或音质菜单时，对话框继续保持打开。不要回退右键菜单的 `popover="manual"`，否则右键释放会触发原生自动关闭。

## 验证

类型检查、客户端测试及扩展构建后，在实际扩展中验证：

1. 播放时连续展开 / 收起，确认音频地址、进度、队列及音量保持，Esc 收起后焦点回到封面按钮。
2. 检查开场和退场动画，尤其关闭时内容没有提前消失；开启减少动态效果后无移动动画。
3. 操作进度、音量、模式和队列；测试播放中与暂停时的音质选择、错误重试，检查控制台。
4. 对话框内打开右键菜单、音质菜单，用鼠标和键盘选择；Esc 应先关闭菜单，再关闭展开页。
5. 在桌面、390px、320px 及矮窗口检查主界面和队列浮窗，无横向溢出，必要时内容区可纵向滚动。检查空队列自动收起和大队列分批显示。
