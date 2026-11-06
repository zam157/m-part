# m-part 账号与房间预设

Web 服务在同一个 Nitro 进程提供 GitHub 登录和云端房间预设。登录后，在「一起听」点击「保存当前」，可保存预设名称、房间服务器地址和昵称。每个账号可保存 30 个不同名称的预设。在另一台设备登录同一个账号后，选择预设并点击「应用」，再使用原有的创建或加入操作。

首版包含网页登录与房间预设。扩展账号登录、音源手动 Cookie 云端保存和创建房间时的取源偏好属于后续阶段。现有一起听房间继续由独立服务管理。

## 本地启动

安装依赖，然后启动本机开发数据库并复制配置样例。

```bash
pnpm install --frozen-lockfile
docker compose -f apps/web/compose.db.yaml up -d
cp apps/web/.env.example apps/web/.env.local
node -e 'console.log(require("node:crypto").randomBytes(32).toString("base64url"))'
```

在 GitHub 的 Settings → Developer settings → OAuth Apps 创建一个 OAuth App。Homepage URL 填 `http://localhost:3411`，Authorization callback URL 填 `http://localhost:3411/api/auth/callback/github`。把 GitHub 生成的 Client ID 和 Client Secret 填入 `apps/web/.env.local`，把上一条 Node 命令生成的随机值填入 `BETTER_AUTH_SECRET`。[GitHub OAuth App 设置](https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/creating-an-oauth-app)

```bash
pnpm --filter @m-part/web db:migrate
pnpm dev
```

打开 [设置页](http://localhost:3411/settings) 并使用 GitHub 登录。浏览器地址、`BETTER_AUTH_URL` 和 GitHub 回调的来源必须一致。要实际创建或加入房间，另开终端执行 `pnpm dev:rooms`。

## 部署

在部署环境提供 `DATABASE_URL`、`BETTER_AUTH_URL`、`BETTER_AUTH_SECRET`、`GITHUB_CLIENT_ID` 和 `GITHUB_CLIENT_SECRET`。公网 `BETTER_AUTH_URL` 填实际 HTTPS 来源，并把该来源下的 `/api/auth/callback/github` 登记到生产 GitHub OAuth App。只有本机回环来源允许 HTTP 登录。应用配置未填齐时，设置页显示账号服务未配置，现有本地播放和一起听仍可使用。

每次数据库结构变更先审查并执行 `pnpm --filter @m-part/web db:migrate`，再启动新版本的 Web 服务。开发时用 `pnpm --filter @m-part/web db:generate --name=<migration-name>` 生成迁移，SQL 与 Drizzle 快照一起提交。数据库连接串、会话签名密钥和 GitHub Client Secret 保存在部署环境或本机的 `.env.local`。

## 实现与验证

- `apps/web/server/account/` 定义 Better Auth、Drizzle 表及预设读写。每次预设操作按会话身份限定用户，写入还校验精确 Origin 和会话绑定的 CSRF 令牌。
- `apps/web/drizzle/` 保存可重复执行的数据库迁移记录。预设的版本号由数据库原子检查与递增，过期的更新或删除返回 409。
- `@m-part/listen-core/room-profile` 声明预设字段，复用一起听服务器地址的校验规则。应用预设只填充表单，实际连接由现有房间操作发起。
- 可用 `ACCOUNT_TEST_DATABASE_URL` 指向测试 PostgreSQL，然后执行 `pnpm --filter @m-part/web exec vitest run test/account-profiles.test.ts`。测试使用具备 `CREATEDB` 权限的用户创建和删除独立的临时数据库，模拟 GitHub 回调并验证登录、数据隔离、CSRF 和并发写入。
