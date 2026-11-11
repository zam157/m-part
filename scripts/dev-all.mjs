import { spawn } from 'node:child_process'
import { randomBytes } from 'node:crypto'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseEnv } from 'node:util'

const root = fileURLToPath(new URL('../', import.meta.url))
const generatedFile = 'apps/web/.env.dev-all.local'
const children = new Set()
const processGroups = process.platform !== 'win32'
let interrupted = false

function readEnv(file) {
  try { return parseEnv(readFileSync(resolve(root, file), 'utf8')) }
  catch (error) {
    if (error.code === 'ENOENT') return {}
    throw error
  }
}

function generatedSecrets() {
  const path = resolve(root, generatedFile)
  try {
    const keys = ['BETTER_AUTH_SECRET', 'MPART_ADMIN_PASSWORD', 'LISTEN_ACCOUNT_SECRET']
    const content = keys.map(key => `${key}=${randomBytes(32).toString('base64url')}`).join('\n')
    writeFileSync(path, content + '\n', { flag: 'wx', mode: 0o600 })
  }
  catch (error) {
    if (error.code !== 'EEXIST') throw error
  }
  return readEnv(generatedFile)
}

function stop(child) {
  if (!child.pid) return
  try {
    if (processGroups) process.kill(-child.pid, 'SIGTERM')
    else child.kill()
  }
  catch (error) {
    if (error.code !== 'ESRCH') throw error
  }
}

function run(command, args, env) {
  const child = spawn(command, args, { cwd: root, env, stdio: 'inherit', detached: processGroups, shell: !processGroups })
  children.add(child)
  return new Promise((resolve, reject) => {
    child.once('error', reject)
    child.once('close', (code, signal) => {
      if (code === 0) resolve()
      else reject(new Error(`${command} ${args.join(' ')} 退出（${signal ?? code}）`))
    })
  }).finally(() => {
    stop(child)
    children.delete(child)
  })
}

for (const [signal, exitCode] of [['SIGINT', 130], ['SIGTERM', 143]]) {
  process.once(signal, () => {
    interrupted = true
    process.exitCode = exitCode
    for (const child of children) stop(child)
  })
}

async function start() {
  const args = process.argv.slice(2)
  if (args.includes('--help')) {
    console.log('pnpm dev:all [--ext]  启动 Web、PostgreSQL 和一起听，可选启动扩展开发')
    return
  }
  if (args.some(arg => arg !== '--ext')) throw new Error('用法为 pnpm dev:all [--ext]')

  const defaults = readEnv('apps/web/.env.example')
  const roomsEnv = { ...readEnv('apps/rooms/.env'), ...readEnv('apps/rooms/.env.local') }
  const env = { ...readEnv('apps/web/.env'), ...readEnv('apps/web/.env.local'), ...process.env }
  for (const key of ['LISTEN_ACCOUNT_SERVER_URL', 'LISTEN_ACCOUNT_SECRET', 'LISTEN_ROOM_DB_PATH']) env[key] ||= roomsEnv[key]
  env.DATABASE_URL ||= defaults.DATABASE_URL
  env.BETTER_AUTH_URL ||= defaults.BETTER_AUTH_URL
  env.LISTEN_ACCOUNT_SERVER_URL ||= 'http://127.0.0.1:3410'
  env.VITE_ROOM_SERVER_URL ||= env.LISTEN_ACCOUNT_SERVER_URL
  const database = new URL(env.DATABASE_URL)
  const loopback = ['127.0.0.1', 'localhost', '[::1]']
  const queryHost = database.searchParams.get('host')
  if (!['postgresql:', 'postgres:'].includes(database.protocol) || !loopback.includes(database.hostname) || (queryHost && !loopback.includes(queryHost)))
    throw new Error('dev:all 会自动迁移数据库，DATABASE_URL 请使用本机 PostgreSQL')

  if (env.DATABASE_URL === defaults.DATABASE_URL) {
    try { await run('docker', ['compose', '-f', 'apps/web/compose.db.yaml', 'up', '--wait', '--wait-timeout', '60', 'postgres'], env) }
    catch (error) {
      if (error.code === 'ENOENT') throw new Error('请先启动 Docker Compose，或用 DATABASE_URL 指向现有本机 PostgreSQL')
      throw error
    }
  }
  if (interrupted) return

  for (const [key, value] of Object.entries(generatedSecrets())) env[key] ||= value
  env.LISTEN_ROOM_DB_PATH = resolve(root, 'apps/rooms', env.LISTEN_ROOM_DB_PATH || '.data/listen.sqlite')
  mkdirSync(dirname(env.LISTEN_ROOM_DB_PATH), { recursive: true })

  await run('pnpm', ['--filter', '@m-part/web', 'db:migrate'], env)
  if (interrupted) return

  console.log(`[dev:all] Web ${env.BETTER_AUTH_URL}，一起听 ${env.LISTEN_ACCOUNT_SERVER_URL}`)
  console.log(`[dev:all] 管理员用户名为 admin，未配置密码时使用 ${generatedFile} 中的 MPART_ADMIN_PASSWORD`)
  const services = [
    run('pnpm', ['--filter', '@m-part/web', 'dev', '--strictPort'], env),
    run('pnpm', ['--filter', '@m-part/rooms', 'dev'], env),
  ]
  if (args.includes('--ext')) services.push(run('pnpm', ['--filter', '@m-part/extension', 'dev'], env))
  try { await Promise.race(services) }
  finally {
    for (const child of children) stop(child)
    await Promise.allSettled(services)
  }
}

try { await start() }
catch (error) {
  if (!interrupted) {
    console.error(`[dev:all] ${error.message}`)
    process.exitCode = 1
  }
}
