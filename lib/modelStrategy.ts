
// ═══════════════════════════════════════════════════════════
//  Model Strategy — 렌즈 교환처럼 모델을 선택하는 순수 함수
//  환경 설정 → 불변 전략 Record 반환
// ═══════════════════════════════════════════════════════════

// ── 타입 ─────────────────────────────────────────────────

export type AspectRatio      = '1:1' | '16:9' | '9:16' | '4:3' | '3:4'
export type VideoAspectRatio = '16:9' | '9:16'

/** 사용자 등급 — types.ts와 동일하나 lib/ 독립성 유지 위해 재선언 */
export type UserTier = 'guest' | 'free' | 'paid' | 'admin'

export type ImageModelStrategy = {
  readonly primary:  string
  readonly fallback: string
  readonly modalities: string[]
  readonly outputMimeType: string
  readonly tier: UserTier
}

export type VideoModelStrategy = {
  readonly model:       string
  readonly resolution:  string
  readonly aspectRatio: VideoAspectRatio
}

// ── 모델 상수 ─────────────────────────────────────────────

/** 무료 티어 — Gemini Flash (무료 API 티어) */
const IMAGE_MODEL_FREE = 'gemini-2.0-flash-exp-image-generation'
/** 유료 티어 — Gemini 3.1 Flash Image Preview (고품질, 2026.02 출시) */
const IMAGE_MODEL_PAID = 'gemini-3.1-flash-image-preview'
/** 공통 fallback — Imagen 4 */
const IMAGE_FALLBACK   = 'imagen-4.0-generate-001'

// ── 순수 선택 함수들 ──────────────────────────────────────

/**
 * selectImageStrategy — 티어에 따라 이미지 모델 전략 선택
 *
 * paid / admin → gemini-3.1-flash-image-preview (고품질, 유료)
 * free / guest → gemini-2.0-flash-exp-image-generation (무료 티어)
 */
export const selectImageStrategy = (_style: string, tier: UserTier = 'free'): ImageModelStrategy => {
  const isPaid = tier === 'paid' || tier === 'admin'
  return {
    primary:        isPaid
      ? (process.env.GEMINI_IMAGE_MODEL_PAID ?? IMAGE_MODEL_PAID)
      : (process.env.GEMINI_IMAGE_MODEL      ?? IMAGE_MODEL_FREE),
    fallback:       process.env.GEMINI_IMAGE_FALLBACK_MODEL ?? IMAGE_FALLBACK,
    modalities:     ['TEXT', 'IMAGE'],
    outputMimeType: 'image/png',
    tier,
  }
}

/**
 * selectVideoStrategy — 비율에 따라 영상 모델 전략 선택
 */
export const selectVideoStrategy = (aspectRatio: VideoAspectRatio): VideoModelStrategy => ({
  model:       process.env.GEMINI_VIDEO_MODEL ?? 'veo-3.1-fast-generate-preview',
  resolution:  '720p',
  aspectRatio,
})

/** 분석용 경량 텍스트 모델 */
export const ANALYSIS_MODEL = 'gemini-2.0-flash'

/** API 키 반환 */
export const getMediaApiKey = (): string =>
  process.env.GEMINI_MEDIA_API_KEY || process.env.API_KEY || ''
