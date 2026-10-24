import { HostedSourceError } from '../providers/shared'
import type { HostedDiagnostics } from '../providers/shared'

const reported = new WeakSet<object>()
const roomMessages = new Set(['房间成员身份已失效，请重新连接', '仅房主可管理房间音源', '实验房间不支持托管音源', '房间状态已更新，请重新操作'])
const errorNames = new Set(['Error', 'TypeError', 'SyntaxError', 'RangeError', 'AbortError', 'TimeoutError', 'AggregateError'])
const networkCodes = /^(?:EAI_AGAIN|ENOTFOUND|ECONNRESET|ECONNREFUSED|ETIMEDOUT|EHOSTUNREACH|ENETUNREACH|EPIPE|CERT_HAS_EXPIRED|DEPTH_ZERO_SELF_SIGNED_CERT|UNABLE_TO_VERIFY_LEAF_SIGNATURE|ERR_TLS_CERT_ALTNAME_INVALID|UND_ERR_(?:CONNECT_TIMEOUT|HEADERS_TIMEOUT|BODY_TIMEOUT|SOCKET|ABORTED|RES_CONTENT_LENGTH_MISMATCH))$/
const number = (value: unknown) => typeof value === 'number' && Number.isSafeInteger(value) ? value : undefined
function message(value: string) {
  return value.replace(/https?:\/\/[^\s"'<>]+/gi, '[URL 已隐藏]')
    .replace(/\b(?:cookie|set-cookie|authorization)\s*[:=][^\r\n]*/gi, '[凭据已隐藏]')
    .replace(/\b(?:MUSIC_U|__csrf|SESSDATA|bili_jct|qqmusic_key|qm_keyst|p_skey|skey|authSecret|ticket|token)\s*[=:]\s*[^\s;,]+/gi, '[凭据已隐藏]')
    .replace(/\bBearer\s+\S+/gi, '[身份已隐藏]').replace(/\b[a-f\d]{64}\b/gi, '[票据已隐藏]').slice(0, 500)
}

/** Log an explicit allowlist only: never serialize Error objects, headers or bodies. */
export function logRoomError(operation: string, error: unknown, context: HostedDiagnostics & { status?: number, expectedBytes?: number, receivedBytes?: number, contentType?: string } = {}) {
  if (error && typeof error === 'object') {
    if (reported.has(error)) return
    reported.add(error)
  }
  // A refresh may fail at the API after a CDN 403: retain the actual failing layer.
  const details = { ...context, ...(error instanceof HostedSourceError ? error.diagnostics : {}) }
  const causes: { name: string, code?: string }[] = []
  let cause = error
  for (let depth = 0; depth < 4 && cause instanceof Error; depth++) {
    const code = 'code' in cause && typeof cause.code === 'string' && networkCodes.test(cause.code) ? cause.code : undefined
    causes.push({ name: errorNames.has(cause.name) ? cause.name : 'Error', ...(code ? { code } : {}) })
    cause = cause.cause
  }
  const detailMessage = error instanceof HostedSourceError || (error instanceof Error && roomMessages.has(error.message)) ? message(error.message) : '请求处理失败'
  console.error('[listen-rooms]', JSON.stringify({
    time: new Date().toISOString(), operation, message: detailMessage,
    provider: ['netease', 'qq', 'bili'].includes(details.provider ?? '') ? details.provider : undefined,
    phase: details.phase,
    endpoint: details.endpoint && /^[\w/.:_-]{1,160}$/.test(details.endpoint) ? details.endpoint : undefined,
    status: number(details.status), httpStatus: number(details.httpStatus),
    contentType: details.contentType && /^[\w.+-]+\/[\w.+-]+$/.test(details.contentType) ? details.contentType.slice(0, 100) : undefined,
    upstreamCodes: details.upstreamCodes?.map(number),
    expectedBytes: number(details.expectedBytes), receivedBytes: number(details.receivedBytes),
    ...(causes.length ? { causes } : {}),
  }))
}
