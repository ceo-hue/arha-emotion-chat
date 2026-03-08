
// ═══════════════════════════════════════════════════════════
//  GenerationError ADT + Retry Policy HOF
//  생성 오류 대수 타입 + 설정 가능한 재시도 고차함수
// ═══════════════════════════════════════════════════════════

import { delay } from './fp'

// ── 오류 ADT ─────────────────────────────────────────────

/** 미디어 생성 오류의 모든 케이스를 망라 */
export type GenerationError =
  | { readonly _tag: 'QuotaExceeded';    readonly retryAfter: number }
  | { readonly _tag: 'ModelUnavailable'; readonly model: string }
  | { readonly _tag: 'InvalidPrompt';    readonly reason: string }
  | { readonly _tag: 'NetworkError';     readonly status?: number }
  | { readonly _tag: 'EmptyOutput' }
  | { readonly _tag: 'Unknown';          readonly message: string }

/** 알 수 없는 예외를 GenerationError로 분류 */
export const classifyError = (raw: unknown): GenerationError => {
  const msg    = (raw as any)?.message ?? String(raw)
  const status = (raw as any)?.status  as number | undefined

  if (status === 429
    || msg.includes('RESOURCE_EXHAUSTED')
    || msg.includes('quota')
    || msg.includes('429'))
    return { _tag: 'QuotaExceeded', retryAfter: 60 }

  if (msg.includes('not found') || msg.includes('404') || msg.includes('MODEL_NOT_FOUND'))
    return { _tag: 'ModelUnavailable', model: msg.slice(0, 80) }

  if (msg.includes('safety') || msg.includes('blocked') || msg.includes('SAFETY'))
    return { _tag: 'InvalidPrompt', reason: '안전 정책에 의해 차단됨' }

  if (status && status >= 500)
    return { _tag: 'NetworkError', status }

  return { _tag: 'Unknown', message: msg.slice(0, 120) }
}

/** 사용자에게 표시할 에러 메시지 */
export const describeError = (e: GenerationError): string => {
  switch (e._tag) {
    case 'QuotaExceeded':    return `API 할당량 초과 — 잠시 후 자동 재시도합니다`
    case 'ModelUnavailable': return '모델을 현재 사용할 수 없어요'
    case 'InvalidPrompt':    return '안전 정책으로 생성이 차단됐어요. 프롬프트를 수정해주세요'
    case 'NetworkError':     return `네트워크 오류가 발생했어요 (${e.status ?? '?'})`
    case 'EmptyOutput':      return '생성 결과가 비어있어요. 다시 시도해주세요'
    case 'Unknown':          return e.message || '알 수 없는 오류가 발생했어요'
  }
}

// ── Retry Policy ─────────────────────────────────────────

export type RetryPolicy = {
  readonly maxAttempts: number
  readonly baseDelayMs: number
  readonly shouldRetry: (e: GenerationError) => boolean
}

/** 이미지 생성 재시도 정책 */
export const IMAGE_RETRY_POLICY: RetryPolicy = {
  maxAttempts: 3,
  baseDelayMs: 1500,
  shouldRetry:  e => e._tag === 'QuotaExceeded' || e._tag === 'NetworkError',
}

/** 영상 생성 재시도 정책 (더 긴 대기) */
export const VIDEO_RETRY_POLICY: RetryPolicy = {
  maxAttempts: 2,
  baseDelayMs: 5000,
  shouldRetry:  e => e._tag === 'QuotaExceeded',
}

/**
 * withRetryPolicy — 지수 백오프 재시도 HOF
 *
 * 설정된 정책(RetryPolicy)에 따라 실패 시 자동 재시도.
 * shouldRetry가 false를 반환하면 즉시 실패(GenerationError) throw.
 *
 * @example
 * const result = await withRetryPolicy(IMAGE_RETRY_POLICY)(() => callGemini())
 */
export const withRetryPolicy =
  (policy: RetryPolicy) =>
  <A>(task: () => Promise<A>): Promise<A> => {
    const attempt = async (n: number): Promise<A> => {
      try {
        return await task()
      } catch (raw) {
        const e = classifyError(raw)
        if (n < policy.maxAttempts && policy.shouldRetry(e)) {
          const waitMs = policy.baseDelayMs * Math.pow(2, n - 1)
          console.warn(`[Retry ${n}/${policy.maxAttempts}] ${e._tag} — ${waitMs}ms 대기`)
          await delay(waitMs)
          return attempt(n + 1)
        }
        throw e
      }
    }
    return attempt(1)
  }
