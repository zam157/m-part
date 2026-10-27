# Provider 通用分段选择

播放器只按 Provider 能力启用选择器，不判断音源名称或曲目 ID 格式。普通播放、添加到下一首、曲目菜单、播放队列菜单和播放栏共用 `TrackPartPicker`；选择结果通过同一套本地队列 / 一起听 `append-many` 操作提交。现有 BiliBili 文案仍显示「分 P」，其他音源默认显示「分段」。

## 接入接口

在 `packages/music/src/types/provider.ts` 的 `Provider` 中：

| 接口 | 约定 |
| --- | --- |
| `getTrackParts(music, { signal? })` | 可选能力；实现后自动启用所有选择入口。按原顺序返回 `MusicInfo[]`，每项与输入同音源，使用唯一、稳定且可独立取源的 ID；单段返回一项，空数组显示可重试错误。支持 AbortSignal 取消请求。 |
| `isTrackPart(music)` | 可选的同步身份判断；已解析的独立分段返回 true，普通添加 / 下一首无需再次查询。判断规则由 Provider 自己维护，不在播放器解析 ID。未实现则每次显式添加都调用 `getTrackParts`。 |
| `trackPartsLabel` | 可选界面名词，默认「分段」，可指定为「章节」「分 P」等；不影响身份和播放逻辑。 |

只有 `getTrackParts` 是启用能力所需的接口。推荐同时提供 `isTrackPart`：该方法应能识别 `getTrackParts` 返回的 ID，避免重新选择已解析曲目。显式从菜单 / 播放栏打开时始终读取完整可选列表，即使输入已是其中一个分段；Provider 应支持这两类输入。

Provider 的 `getSourceInfo` 必须能按每个分段 ID 获取正确音源。可以在 `SourceInfo.track` 返回规范化资料，让旧容器条目在普通播放后获得正确的独立 ID、标题和时长。不要把上游音频 URL 或 Cookie 放进分段 ID / 元数据；稳定 ID 需要能在缓存、队列和房间中直接使用，不能仅依赖本地临时映射。

## 选择与一起听

只有一段时直接执行原操作；多段等待用户明确选择，关闭 / Escape 不更改队列。提供筛选、多选、全选、播放、加入队列与设为下一首。取消旧查询或切换播放环境后，迟到结果不会应用到新的选择或房间；房主 / 管理员权限仍按现有规则检查。

一起听公开曲目仍只含现有白名单字段，不新增协议字段，协议版本为 7。未解析容器通过能力判断以未知时长进入房间，不能把容器总时长当作单段时长；由房主媒体就绪建立时间轴。已解析分段保留自身时长，服务广播回来的权威时长不再次清零。

批量播放整张歌单仍不自动展开每个容器。各 Provider 必须保留旧 ID 的取源兼容规则。接入服务器托管时，还需让对应的 `apps/rooms/server/providers/` 适配器理解相同的稳定 ID；通用选择器不替代服务器的音源 / 权限实现。

## 实现位置

- `packages/player/src/utils/track-parts.ts`：能力、文案与是否需要解析的判断。
- `packages/player/src/composables/track-parts.ts`：按 `music.provider` 分发查询、取消 / 重试与选择状态。
- `packages/player/src/components/TrackPartPicker/`：通用选择器。
- `packages/player/src/composables/player.ts`：播放环境与权限检查、本地 / 房间队列提交。
- `packages/player/src/utils/listen-client.ts`：通用容器时长处理与房间协议。

BiliBili 专有的 BV / CID 校验只在其 Provider 和服务适配器中维护，详见 [分 P 播放](./bilibili-parts.md)。

## 验证记录（2026-10-24）

520 项自动测试、完整 workspace 类型检查及 Web / 扩展 / rooms 构建通过。使用非 BiliBili 的测试 Provider 和任意格式的分段 ID 验证默认 / 自定义文案、单选 / 多选、普通播放、下一首不中断、房间批量提交、容器时长、权限与播放环境切换。测试 Provider 不代表 QQ / 网易云已实现该能力。

实际开发扩展刷新后，BiliBili 716P 列表仍显示「分 P」，选择 P2 使用正确 CID，原生音频时长约 1024.28 秒且进度持续增加。临时注入的非 BiliBili 测试能力显示「选择章节」，390px 视口正常，取消后恢复原 Provider；未接入真实平台章节接口。侧栏、主题、Tooltip 与跨断点操作无 Solid 响应式 / 清理警告。
