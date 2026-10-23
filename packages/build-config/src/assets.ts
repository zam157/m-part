import { cpSync, existsSync, mkdirSync, readFileSync, statSync } from 'node:fs'
import path from 'node:path'

/** Materialize shared static files in each shell; DNR rules remain extension-only. */
export function preparePublicDir(appDir: string) {
  const publicDir = path.join(appDir, 'public')
  mkdirSync(publicDir, { recursive: true })
  cpSync(path.resolve(import.meta.dirname, '../public'), publicDir, {
    recursive: true,
    // WXT watches public files. Rewriting an unchanged script causes reload loops.
    filter: (source, target) => statSync(source).isDirectory() || !existsSync(target) || !readFileSync(source).equals(readFileSync(target)),
  })
  return publicDir
}
