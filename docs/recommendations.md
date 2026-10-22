# 首页推荐

`shared/types/provider.ts` 的 `Provider.getRecommendations?: () => Promise<MusicInfo[]>` 提供首页推荐音乐。不支持该能力的后续音源可以省略该方法。

- 返回音乐条目而非播放 URL，必须带正确的 `provider`、`id`、标题、秒数时长和 HTTPS 封面；点击时复用 `addToPlayQueue`，再由该音源的 `getSourceInfo` 获取最新播放地址。
- 推荐标题按普通文本渲染。不要因为 BiliBili 搜索标题包含高亮 HTML 就对推荐标题使用 `innerHTML`。
- 无推荐时返回 `[]`；网络和业务失败抛错，不能伪装成空数组。
- 请求经过 Provider 与 `tRequest`，沿用扩展的凭据和 DNR 策略。

## 当前音源

| 音源 | 内容与接口 |
| --- | --- |
| BiliBili | 音乐分区榜单：`/x/web-interface/ranking/region`，`rid: 3`、`day: 3`，最多取前 20 条；返回的作者、`mm:ss` / `hh:mm:ss` 时长与封面复用搜索映射 |
| 网易云 | 推荐新歌：`/api/personalized/newsong`，经现有 WEAPI 加密请求，`type: recommend`、`limit: 20`、`areaId: 0`；展开 `result[].song` 并复用歌曲映射 |

两者使用公开内容，无需先登录；不代表登录后的个性化每日推荐，推荐可获取也不代表每首都具有播放权限。网易云请求参数参考上游 [personalized_newsong](https://github.com/NeteaseCloudMusicApiEnhanced/api-enhanced/blob/main/module/personalized_newsong.js)，未引入 Node 库。

实测 BiliBili `/ranking/v2` 可能返回业务码 `-352`，当前使用音乐分区 `/ranking/region`。不要直接切到全站热门接口，避免把非音乐内容混入首页；接口风控或网络失败由错误态与重试处理。

## 首页状态

`client/composables/recommendations.ts` 以音源为键保存模块级信号：`items`、`loading`、`loaded`、`error`。`Recommendations` 组件按音源单独渲染，首次加载顺序为错误 → 加载 → 数据 → 空状态。首页在两个推荐分区结束，不再展示底部搜索灵感栏目。

- 首次进入首页并行加载；离开路由再返回复用已成功获取的结果，包括空结果。
- 同一音源合并在途请求，避免重复加载和刷新响应覆盖。
- 刷新或重试仅请求对应音源，一个音源失败不会清空另一个的结果。
- 已成功加载后刷新时保留原列表（含空结果），只禁用刷新按钮并显示旋转图标，不切换为骨架，避免内容区高度瞬间收缩。成功后替换结果；失败显示提示并保留旧结果供继续播放，初次失败仍用完整错误态。
- 缓存只存在于当前页面会话，刷新扩展页面后重新请求。

## 验证

运行类型检查与客户端测试后，在实际扩展首页确认两个分区均返回内容；分别点击推荐音乐，检查播放队列中的音源与 ID 正确且可播放。检查单独刷新、断网失败与恢复后的重试，以及离开首页再返回时的缓存。窄屏检查推荐网格没有横向溢出，最后检查控制台。

QQ 音乐使用 `newsong.NewSongServer.get_new_song_info` 提供新歌，沿用独立缓存、失败重试与刷新时保留内容的行为；实现及权限见 [QQ 音乐音源](./qq.md)。
