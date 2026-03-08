
// ═══════════════════════════════════════════════════════════
//  Prompt Pipeline — 라이트룸 프리셋처럼 합성 가능한 변환기
//  사진작가의 현상 워크플로우를 함수 합성으로 모델링
// ═══════════════════════════════════════════════════════════

import { pipe } from './fp'

// ── 기본 타입 ─────────────────────────────────────────────

/** 프롬프트 변환기 — 단방향 순수 함수 */
export type PromptTransformer = (prompt: string) => string

// ── 원자적 변환기들 (단일 책임) ───────────────────────────

/** ARHA 캐릭터 페르소나 주입 */
export const withArhaPersona: PromptTransformer = p =>
  `In the style of a thoughtful 20-something Korean student named Arha: ${p}`

/** 스타일 suffix 추가 */
export const withStyleSuffix = (suffix: string): PromptTransformer => p =>
  suffix ? `${p}, ${suffix}` : p

/** 사진 품질 부스터 */
export const withQualityBoost: PromptTransformer = p =>
  `${p}, high quality, professional, detailed`

/** 영화적 조명 */
export const withCinematicLighting: PromptTransformer = p =>
  `${p}, cinematic lighting, natural shadows, beautiful light`

/** 선명도 강화 */
export const withSharpFocus: PromptTransformer = p =>
  `${p}, sharp focus, ultra detailed, 8K resolution`

/** 항등 변환 — 파이프라인 자리 채움용 */
export const identityTransformer: PromptTransformer = p => p

// ── 스타일 suffix 사전 ────────────────────────────────────

export const STYLE_SUFFIX: Readonly<Record<string, string>> = {
  arha:       '',
  photo:      'photorealistic, high quality photography, natural lighting, sharp details, DSLR',
  anime:      'anime illustration style, vibrant colors, detailed linework, Studio Ghibli aesthetic',
  watercolor: 'soft watercolor painting style, flowing brushstrokes, pastel tones, artistic texture',
  oil:        'oil painting style, rich impasto texture, impressionistic brushwork, masterpiece quality',
  sketch:     'detailed pencil sketch, fine crosshatching lines, monochrome, artistic illustration',
}

// ── 재요청 보정 시스템 ────────────────────────────────────

/** 재요청 의도 타입 */
export type RefinementIntent = {
  readonly type:    'brighten' | 'darken' | 'colorize' | 'add' | 'remove' | 'style' | 'sharpen' | 'blur' | 'generic'
  readonly label:   string  // 한국어 레이블
  readonly suffix:  string  // 프롬프트에 추가할 suffix
}

/** 사용자 요청 텍스트 → RefinementIntent (순수 함수, 로컬 패턴 매칭) */
export const detectRefinementIntent = (request: string): RefinementIntent => {
  const r = request.toLowerCase()

  if (/밝|bright|lighter|환하|high.?key/.test(r))
    return { type: 'brighten',  label: '밝기 증가',    suffix: ', brighter exposure, high key lighting, luminous' }

  if (/어둡|dark|dim|low.?key|무거/.test(r))
    return { type: 'darken',    label: '어두운 톤',    suffix: ', darker mood, low key lighting, deep shadows' }

  if (/색감|컬러|color|vivid|선명|채도|saturate/.test(r))
    return { type: 'colorize',  label: '색감 강화',    suffix: ', vivid colors, high saturation, color grading' }

  if (/선명|sharp|focus|또렷/.test(r))
    return { type: 'sharpen',   label: '선명도 강화',  suffix: ', tack sharp, ultra detailed, crisp edges' }

  if (/흐리|blur|bokeh|아웃포커/.test(r))
    return { type: 'blur',      label: '아웃포커스',   suffix: ', shallow depth of field, beautiful bokeh, f/1.4' }

  if (/추가|넣어|add|포함|넣고/.test(r))
    return { type: 'add',       label: '요소 추가',    suffix: `, ${request}` }

  if (/제거|없애|remove|빼|삭제/.test(r))
    return { type: 'remove',    label: '요소 제거',    suffix: `, without ${request}, remove ${request}` }

  if (/스타일|느낌|style|분위기|톤/.test(r))
    return { type: 'style',     label: '스타일 변경',  suffix: `, ${request} style, ${request} atmosphere` }

  return { type: 'generic',     label: '일반 보정',    suffix: `, ${request}` }
}

/** 재요청 변환기 생성 */
export const withRefinement = (intent: RefinementIntent): PromptTransformer => p =>
  p + intent.suffix

// ── 파이프라인 빌더 ───────────────────────────────────────

export type ImagePromptOptions = {
  readonly style:       string
  readonly refinements: ReadonlyArray<RefinementIntent>
}

/**
 * buildImagePrompt — 이미지 프롬프트 파이프라인 빌더
 *
 * 스타일 suffix → 보정 suffix들 → ARHA 페르소나 순서로 합성.
 * 새로운 스타일/보정 추가 시 이 함수만 수정.
 */
export const buildImagePrompt = (opts: ImagePromptOptions): PromptTransformer =>
  pipe(
    withStyleSuffix(STYLE_SUFFIX[opts.style] ?? ''),
    ...opts.refinements.map(withRefinement),
    withArhaPersona,
  )

/**
 * buildVideoPrompt — 영상 프롬프트 파이프라인
 *
 * 영상은 ARHA 페르소나 + 영화적 품질 강화.
 */
export const buildVideoPrompt: PromptTransformer =
  pipe(
    withArhaPersona,
    withCinematicLighting,
  )
