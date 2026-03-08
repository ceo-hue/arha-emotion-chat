
// ═══════════════════════════════════════════════════════════
//  Model Strategy — 렌즈 교환처럼 모델을 선택하는 순수 함수
//  환경 설정 → 불변 전략 Record 반환
// ═══════════════════════════════════════════════════════════

// ── 타입 ─────────────────────────────────────────────────

export type AspectRatio      = '1:1' | '16:9' | '9:16' | '4:3' | '3:4'
export type VideoAspectRatio = '16:9' | '9:16'

export type ImageModelStrategy = {
  readonly primary:  string
  readonly fallback: string
  readonly modalities: string[]
  readonly outputMimeType: string
}

export type VideoModelStrategy = {
  readonly model:       string
  readonly resolution:  string
  readonly aspectRatio: VideoAspectRatio
}

// ── 환경변수 읽기 — Vite define이 리터럴만 교체하므로 직접 참조 ──

// ── 순수 선택 함수들 ──────────────────────────────────────

/**
 * selectImageStrategy — 스타일에 따라 이미지 모델 전략 선택
 *
 * 모든 스타일에 동일한 전략 사용.
 * 추후 스타일별 특화 모델로 확장 가능.
 */
export const selectImageStrategy = (_style: string): ImageModelStrategy => ({
  primary:         process.env.GEMINI_IMAGE_MODEL          ?? 'gemini-2.0-flash-exp-image-generation',
  fallback:        process.env.GEMINI_IMAGE_FALLBACK_MODEL ?? 'imagen-4.0-generate-001',
  modalities:      ['TEXT', 'IMAGE'],
  outputMimeType:  'image/png',
})

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
