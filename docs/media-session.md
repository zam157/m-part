# 系统媒体控制

`packages/player/src/composables/media-session.ts` 在 `packages/player/src/main.tsx` 中启动，网页和扩展共用。通过 `navigator.mediaSession` 将当前歌曲的标题、歌手、专辑及封面同步到系统媒体界面，接收锁屏、通知栏及媒体键操作。实际按钮与进度条由浏览器和操作系统决定。

- 播放 / 暂停复用 `setPlaying`；上下首复用 `prevNext`，保留随机、顺序与循环模式的现有规则。停止会暂停并归零，保留队列。
- 跳转及快进 / 快退复用 `setCurrentTime`；未指定快进 / 快退距离时使用 10 秒，位置限制在实际媒体时长内。
- 进度来自共享 `audio` 的媒体事件，不增加定时器。切歌加载期间清除旧位置，元数据就绪后发布实际时长、进度与播放速率；未知时长和非法数值不发布。
- 缓存恢复只展示歌曲资料和暂停状态，不自动播放。系统点击播放后仍由现有恢复流程重新获取音源、恢复进度。
- 空队列清除元数据、位置与操作处理器；热更新会移除事件监听和响应式观察，避免重复注册。回到前台时同步真实媒体状态。
- 缺少 API 时保留普通页面播放；逐项忽略 `setActionHandler` 的 `NotSupportedError`，缺少位置或元数据 API 时其他控制仍可用。封面升级为 HTTPS，无有效地址则不发布 artwork。

Media Session 提供系统媒体控制，不授予网页持续后台执行权限，不能保证移动系统冻结页面后继续自动切歌。这里未增加静音保活、后台 Worker 或原生后台播放服务。

## 验证

运行前端类型检查与客户端测试。测试覆盖真实播放器的系统操作、元数据切换、进度边界、缓存恢复、部分 API 支持及销毁清理。

扩展页面中播放真实歌曲，确认 `navigator.mediaSession.metadata` 与 `playbackState` 正确，再从系统媒体界面检查暂停 / 继续、上下首及跳转；清空队列后确认信息清除。移动锁屏和耳机媒体键需要 Android / iOS 真机验证，桌面设备模拟不能代替。

API 参考：[setActionHandler](https://developer.mozilla.org/en-US/docs/Web/API/MediaSession/setActionHandler)、[setPositionState](https://developer.mozilla.org/en-US/docs/Web/API/MediaSession/setPositionState)。
