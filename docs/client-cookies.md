# 客户端音源 Cookie

侧栏「音源设置」允许为网易云、QQ 音乐、BiliBili 分别填写 Cookie 请求头内容（`name=value; name2=value2`，可带 `Cookie:` 前缀）。三个平台互不影响；输入框不会回显已保存的内容，保存成功后清空。登录提示中的「填写 Cookie」也可进入设置。

## 来源选择与保存

- 每个平台通过选择器独立选择「手动 Cookie」或「网站 Cookie」。切换来源不会修改或删除已保存的手动值，切回手动模式直接复用。填写或更新 Cookie 也不自动切换来源。
- 手动模式：该平台 API 使用保存的整套会话，不与网站 Cookie 混合。网易云的 `__csrf`、QQ 的账号与认证 key 也只从手动值提取；缺字段时不会补读网站账号。没有保存值时提示先填写，失效或权限不足时显示平台的未登录 / 错误状态，均不静默切换网站账号。
- 网站模式：请求使用现有浏览器网站登录态，保留的手动值不会参与 Cookie 头、CSRF、QQ token 或 Web 转发。
- 「清除 Cookie」仅删除当前平台保存在本地的手动值，不改变已选来源，也不清理平台网站的 Cookie。手动模式清除后需重新填写，或主动切换网站模式。
- 手动值按平台保存在当前客户端源的 `localStorage`，键为 `mpart-client-cookie:<provider>`；模式独立保存在 `mpart-client-cookie-mode:<provider>`（`manual` / `website`），刷新及重启后保留。旧设置没有模式键时，已有 Cookie 继续按手动模式使用，否则默认为网站模式；首次更改会明确保存该模式。这是明文的本机存储，不是加密保险箱；不要复制到队列、本地歌单、房间记录或日志。清除站点 / 扩展存储也会移除这些设置。
- 来源或生效的手动 Cookie 改变后，清空相关平台的搜索与账号歌单结果；在途旧响应失效，避免旧账号资料覆盖新账号。网站模式下保存或清除备用值不影响当前账号结果。另一个客户端标签页通过 `storage` 事件同步状态与结果失效。不会因此切歌或修改一起听托管设置。

## 请求出口

实现集中在 `@m-part/music/client-cookies` 与 `utils/fetch.ts`，组件及 Provider 不自行拼 Cookie 请求头。`provider-request.ts` 同时约束客户端与 Web 服务的目的地址，只接受三个平台的固定 HTTPS API 主机与路径；不向封面、音频 CDN 或房间服务器转发手动 Cookie。

## Provider 声明与接入

Cookie 是 `ProviderDefinition.cookie` 的可选能力，完整 `Provider` 继承该声明。每个平台在 `providers/<name>-definition.ts` 定义一份轻量元数据，Provider 实现展开同一份声明；`@m-part/music/provider-definitions` 负责统一注册。设置页与状态监听只遍历已声明 Cookie 能力的平台，不包含各平台名称、输入提示、网站地址或规则分支。

`ProviderCookieConfig` 包含 `label`、`placeholder`、`loginUrl`、Web 转发的 `requestOrigin`、稳定且全局唯一的扩展 `ruleId`，以及非空的 `targets`。每个 target 使用固定 HTTPS `origin` 与 `path` 前缀；单一接口加 `exact: true`。请求分类、Web 允许列表和扩展 DNR 正则从同一组 targets 生成，不能分别维护域名正则；不要包含媒体 CDN、图片或任意代理地址。已有 rule ID 11001 / 11002 / 11003 必须保留，升级后才能替换或清除旧会话规则。

接入新音源时扩展 `ProviderName`，注册其轻量声明与 Provider 实现，并按需要配置扩展 host permissions；提供 `cookie` 即可自动接入设置表单、存储、规则和 Web 转发，不需要修改这些通用消费方。缺省 `cookie` 则不显示设置，也不接受手动会话。CSRF、token 等平台专有认证字段继续由各自 Provider 的会话代码解析。

轻量声明模块只能包含类型与静态元数据，禁止导入 Provider 实现、fetch、客户端存储或浏览器 API。传输层和 Web 服务都要读取这些声明；导入完整 Provider 会导致 `Provider → fetch → Provider` 循环依赖，也会把浏览器代码带入服务端。

## 传输形态

扩展使用 `declarativeNetRequest.updateSessionRules` 的会话规则替换 API Cookie，请求本身采用 `credentials: 'omit'`，不混入网站 Cookie，也不把响应的 `Set-Cookie` 写回网站。规则仅匹配当前扩展发起的 API 请求，不影响用户打开的平台网页。规则会在请求前重建，保存或应用失败会明确报错，不降级使用网站账号。网站 Cookie 始终不被设置或删除。

Web 形态不能直接设置浏览器禁止的 Cookie 头，因此手动模式的 Cookie 请求经过本站 Nitro 的 `POST /api/provider-request`。服务器只转发固定官方 API，禁止跳转，不保存 Cookie，不返回上游 `Set-Cookie`，响应为 `no-store`；错误不包含原始异常或凭据。部署者能够接触经过该服务的凭据，应使用自己信任的部署。需要运行 Web 的 Nitro 服务（例如构建后 `node apps/web/dist/server/index.mjs`）；仅有 Vite 静态开发资源不足以提供此接口。网站模式沿用已有请求方式，纯 Web 仍受 CORS / 第三方 Cookie 策略限制，不能保证复用其他网站登录态。

GM 入口在已有 `__tFetch` 传输中显式传递手动 Cookie；它是否支持该头取决于宿主能力。本次未进行 GM 宿主实测。

一起听的「各自取源」使用成员本机的这套设置；「服务器取源」继续使用房主在房间弹窗显式绑定的服务器会话。客户端 Cookie 不会自动提交给一起听服务器。下载也沿用本机 Provider 会话。

## 验证范围

自动测试覆盖格式、按平台保存值与模式、切换保留、单独清除、旧设置兼容、规则范围与失败回滚、Cookie / CSRF / QQ token 一致性、账号切换旧响应、Web 转发边界和设置表单。实际 Chrome 扩展使用合成测试 Cookie 验证请求头替换与网站凭据恢复，网站 Cookie 不被改写；Web Nitro 已验证手动请求转发与禁止缓存。合成 Cookie 不代表三个真实登录账号或会员权限已验收。
