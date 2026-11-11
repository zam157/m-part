# m-part 账号与房间预设

Web 服务在同一个 Nitro 进程提供用户名密码登录和云端房间预设。管理员的用户名固定为 `admin`，密码由部署时的 `MPART_ADMIN_PASSWORD` 设置。管理员在「设置 → m-part 账号」登录后，可创建普通用户，并自行将用户名和初始密码交给用户。用户在同一页面使用收到的账号登录。

在「一起听」点击「保存当前」，可保存预设名称、房间服务器地址和昵称。每个账号可保存 30 个不同名称的预设。在另一台设备登录同一个账号后，选择预设并点击「应用」，再使用原有的创建或加入操作。

首版包含网页登录与房间预设。扩展账号登录、音源手动 Cookie 云端保存和创建房间时的取源偏好属于后续阶段。现有一起听房间继续由独立服务管理。

## 本地启动

安装依赖，然后启动本机开发数据库并复制配置样例。

```bash
pnpm install --frozen-lockfile
docker compose -f apps/web/compose.db.yaml up -d
cp apps/web/.env.example apps/web/.env.local
node -e 'console.log(require("node:crypto").randomBytes(32).toString("base64url"))'
```

把上一条 Node 命令生成的随机值填入 `apps/web/.env.local` 的 `BETTER_AUTH_SECRET`，再为 `MPART_ADMIN_PASSWORD` 填入单独的 12 到 128 个字符的管理员密码。

```bash
pnpm --filter @m-part/web db:migrate
pnpm dev
```

打开 [设置页](http://localhost:3411/settings)，用 `admin` 和上面设置的密码登录。浏览器地址与 `BETTER_AUTH_URL` 的来源必须一致。要实际创建或加入房间，另开终端执行 `pnpm dev:rooms`。

## 部署

在部署环境提供 `DATABASE_URL`、`BETTER_AUTH_URL`、`BETTER_AUTH_SECRET` 和 `MPART_ADMIN_PASSWORD`。公网 `BETTER_AUTH_URL` 填实际 HTTPS 来源。只有本机回环来源允许 HTTP 登录。应用配置未填齐时，设置页显示账号服务未配置，现有本地播放和一起听仍可使用。

首次启动及数据库结构变更时，先执行 `pnpm --filter @m-part/web db:migrate`，再启动 Web 服务。数据库连接串、会话签名密钥和管理员密码保存在部署环境或本机的 `.env.local`。如需更换管理员密码，更新 `MPART_ADMIN_PASSWORD` 并重启全部 Web 实例。服务下次处理账号请求时会更新密码并使管理员旧会话失效。

账号服务对登录请求限速。只有在 Web 服务仅能经可信反向代理访问，且代理会覆盖指定请求头时，才将 `ACCOUNT_CLIENT_IP_HEADER` 设为该头的名称，例如 `x-real-ip`。未设置时，同一 Web 进程的登录请求共用限额。

## 实现与验证

- Better Auth 负责密码哈希和会话。管理员建号和预设写入都校验精确 Origin 和会话绑定的 CSRF 令牌。每次预设操作按会话身份限定用户。[Better Auth 密码认证](https://better-auth.com/docs/authentication/email-password)
- `apps/web/drizzle/` 保存可重复执行的数据库迁移记录。预设的版本号由数据库原子检查与递增，过期的更新或删除返回 409。
- `@m-part/listen-core/room-profile` 声明预设字段，复用一起听服务器地址的校验规则。应用预设只填充表单，实际连接由现有房间操作发起。
- 可用 `ACCOUNT_TEST_DATABASE_URL` 指向测试 PostgreSQL，然后执行 `pnpm --filter @m-part/web exec vitest run test/account-profiles.test.ts`。测试使用具备 `CREATEDB` 权限的用户创建和删除独立的临时数据库，并验证管理员建号、登录、数据隔离、CSRF 和并发写入。
