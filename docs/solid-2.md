# Solid 2 使用笔记

仓库用的是 Solid 2 的 RC（`solid-js` / `@solidjs/web` `2.0.0-rc.8`，`@solidjs/router` `2.0.0-next.24`）。
它与 Solid 1 差异不小，而且 dev 模式会把「写法看着没问题、但根本不会更新」的情况直接报出来。
下面每一条都在本仓库踩过，改代码前先扫一眼。

## 版本与包

| 包 | 版本 | 备注 |
| --- | --- | --- |
| `solid-js` / `@solidjs/web` | `2.0.0-rc.8` | 控制流组件来自 `solid-js`，DOM API 来自 `@solidjs/web` |
| `@solidjs/router` | `2.0.0-next.24` | 预发布版本，catalog 里按精确版本锁定 |
| `@solidjs/vite-plugin` | `3.0.0-next.43` | 旧的 `vite-plugin-solid` 已更名，v3 只是再导出新包 |
| `filesystem-routing` | `0.3.1` | 生成 `virtual:file-routes` |

- JSX 类型来自 `@solidjs/web`（`packages/player/tsconfig.json` 的 `jsxImportSource`），不要写 `import { h } from 'solid-js'`
- **`solid-js/web` 与 `solid-js/store` 子路径已删除**：`render` / `Portal` / `Dynamic` / `isServer` 从 `@solidjs/web` 导入；`createStore` 仍在 `solid-js` 根导出
- 控制流重命名：`<Suspense>` → `<Loading>`、`<ErrorBoundary>` → `<Errored>`；`<For>` / `<Show>` / `<Switch>` / `<Match>` 保留
- 已移除：`onMount`（改用 `createEffect` 或 `onSettled`）、`batch`、`produce`、`createSelector`、`createDeferred`、`observable`、`indexArray`
- 存在：`flush`、`onSettled`、`createTrackedEffect`、`createUniqueId`、`mergeProps`、`splitProps`、`untrack`
- 本项目**不启用自动导入**，所有 API 显式 import

## 1. 信号写入是「暂存」的

`setA(1)` 之后在**同一个同步块内**读 `a()` 拿到的还是旧值，要等下一次 flush 才提交。

```ts
const [a, setA] = createSignal(0)
setA(1)
a() // => 0
flush()
a() // => 1（下一个 microtask 也会自动提交）
```

推论：

- 不要「写完立刻回读」，把新值显式传参。参考 `packages/player/src/composables/player.ts`：`createRandomOrder(length)` 是纯函数，`playSource(music, src, provider)`、`loadQuality(sourceInfo, quality)` 都把值显式带进来
- **事件处理器里同样会踩**：`MusicPlayer` 的进度条曾把「本次手势的 rect」存成 signal，`pointerdown` 里写完后在同一个同步块里读 → 拿到 `null` → 表现是「拖动能调进度、单击不能」（拖动靠随后的 `pointermove`，那时写入已提交）。这种一次手势内的中间量用普通 `let`，不要用 signal
- 测试里断言前先提交：`import { flush } from 'solid-js'`；`packages/player/test/composables/player.test.ts` 用 `commit(() => action())` 包装

## 2. ⚠️ 渲染期写信号会直接抛错（不是警告）

`REACTIVE_WRITE_IN_OWNED_SCOPE`（`@solidjs/signals/dist/dev-shared.js` 里 `setSignal` 的守卫）：

```
Write into reactive state inside an owned scope (component, computation) is not allowed
```

踩坑实录：给详情页加错误态时，把 `setInfoError(null)` 写在加载函数开头，而该函数**在组件体里被直接调用**（渲染期）→ 抛错 → `Uncaught (in promise)`，**请求根本没发出去**（网络面板里零请求，最难查的一次）。

规矩：

- 组件体里直接调用的异步加载函数，**每个 set 都要排在某个 `await` 之后**（`await` 之后的续体已经不在 owned scope 里）
- 需要「初始就是空」的状态，用 `createSignal(<从能力推导的初值>)`，别在渲染期补写
- 事件处理器（`onClick`、tab 切换、分页回调）里的同步 set 是合法的
- 逃逸口（未采用）：`createSignal(v, { ownedWrite: true })`

## 3. ⚠️ 渲染期读响应式值会告警，而且真的不更新

`STRICT_READ_UNTRACKED`：组件体里直接读响应式值拿到的是**永不更新的快照**（`strictRead` 标志由 `untrack(fn, label)` 打标，见 `@solidjs/signals/dist/dev-shared.js`）。要触发它，读的必须是真的从 **store** 上取属性：

- **路由参数**：`useParams()` 返回 store，`params.provider` / `params.id` 在组件体里读会告警（详情页曾各 2 条），而且换个 id 页面确实不更新。
  解法 —— `keyed` 的 `<Show>`：它在追踪作用域里读，并把**原始值**（不是 accessor）传给子组件；参数一变整块重建（≈ 重新挂载），数据自然重拉：

  ```tsx
  const routeParams = () => (params.provider && params.id ? { provider: params.provider, id: params.id } : null)

  return (
    <Show when={routeParams()} keyed>
      {route => <TheView provider={route.provider} id={route.id} />}
    </Show>
  )
  ```

- **`useSearchParams()`**：它内部读 `router.location`，在组件体里调用即告警；它返回的 query store 在组件体里取属性也告警 —— `getAlbumWorks` 在首个 `await` 之前就同步读 `extra.mid`，而调用点在渲染期，这处最难看出来。
  解法 —— 整块包进 `untrack`（不带 label 时会清掉 `strictRead` 标志，是官方出口）：

  ```tsx
  const [searchParams] = untrack(() => useSearchParams())
  const query = untrack(() => ({ mid: queryValue(searchParams.mid), ... }))
  ```

  注意**套一层 `createMemo` 没用**：无人订阅的 memo 首次被渲染期读取时 compute 里没有 observer，store 读取照样告警（实测确认）。
- 事件处理器里读、JSX / memo / effect 里读都没问题
- `useParams()` / `useLocation()` 这类 hook 本身返回值不算「读」（返回 accessor 或 store），只要不在组件体里取属性即可

## 4. Loading 边界（ASYNC_OUTSIDE_LOADING_BOUNDARY）

`render()` 在**初始挂载**期间会强制检查 Loading 边界（`enforceLoadingBoundary(true)`），此时若有异步读取逃到根节点就会告警，并把整棵根节点的挂载推迟到异步就绪。本项目里的来源是 `filesystem-routing` 的代码分割路由（`@solidjs/router/fs` 用 `lazy()` 包装组件）。

已在 `packages/player/src/App.tsx` 修好：只把**内容区**包进 `<Loading fallback={<PageLoading />}>`，侧边栏 / 播放列表 / 播放器留在边界外 —— 初始加载时外壳立刻可见，只有内容区显示 loading；站内跳转到未加载的分块时保留旧内容不闪。

**不要把整个 shell 或 `<Router>` 包进边界**（会整屏闪回 fallback）。

## 5. 其他容易踩的

- **`style` 属性不要用对象展开合并**：Solid 的 `style` 同时接受声明串和驼峰对象，`{ ...'color:red;' }` 会得到 `{0:'c',1:'o',…}`，浏览器整条丢弃 → 静默失效。最省事的做法是根本别注入行内样式
- `classList` 已从 JSX 类型移除：条件类名用 `clsx`（见 [styling.md](./styling.md)）
- `aria-*` 只接受 `'true' | 'false'` 字面量；空元素必须自闭合（`<img ... />`）
- 数组状态保持不可变：`setList([...list(), item])`
- 模块级的 `createMemo` / `createEffect` 要包在 `createRoot(...)` 里（`packages/player/src/composables/player.ts` 就是这么做的），否则 dev 会提示 owner 缺失

## 6. 测试

- Vitest 不需要手工配置：`@solidjs/vite-plugin` 会自动注入（jsdom 默认环境、客户端姿态、jest-dom setupFiles）；它在 `config` hook 里读 `userConfig.test.environment` 判断姿态
- 遇到「`createSignal` 写不进去」先怀疑暂存 / flush，而不是解析到了 SSR 构建（SSR 的 setter 会走 `warnServerWrite`，同样是静默忽略）
- 断言前 `flush()`；`pnpm test:backend` 需要先构建并启动 Web 生产服务
- `pnpm test` 退出码是 0，但结尾会打印 `close timed out after 10000ms`（jsdom + vitest 4 的既有现象）

## 7. 工具链

- `pnpm 12.3.4` 无法解析带 `//` 注释的 `package.json`（报 `key must be a string at line N`）→ `package.json` 必须是纯 JSON
- 类型检查用 `pnpm typecheck`（`vue-tsc` 已移除）
- `pnpm lint` **不可用**：`typescript-eslint` 尚不支持本仓库的 TypeScript 7.x（既有问题，别拿它当验收）
