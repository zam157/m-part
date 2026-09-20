interface ViteTypeOptions {
  // By adding this line, you can make the type of ImportMetaEnv strict
  // to disallow unknown keys.
  // strictImportMetaEnv: unknown
}

interface ImportMetaEnv {
  readonly VITE_USE_PROXY: string
  readonly VITE_USE_GM_FETCH: string
  /** 由扩展构建注入（见 vite.config.extension.ts），web 构建下为 undefined */
  readonly VITE_TARGET?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
