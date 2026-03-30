
// ═══════════════════════════════════════════════════════════
//  Prompt Pipeline v2 — 전문 스튜디오급 프롬프트 엔지니어링
//  피사체 감지 → 구도 → 카메라 스펙 → 아트 디렉션 → ARHA 서명
//  사진작가의 현상 워크플로우를 함수 합성으로 모델링
// ═══════════════════════════════════════════════════════════

import { pipe } from './fp'

// ── 기본 타입 ─────────────────────────────────────────────

/** 프롬프트 변환기 — 단방향 순수 함수 */
export type PromptTransformer = (prompt: string) => string

// ── 피사체 분류 시스템 ────────────────────────────────────

/** 피사체 유형 — 구도/카메라/모션 전략 선택에 사용 */
export type SubjectType =
  | 'portrait'      // 인물
  | 'landscape'     // 풍경/자연
  | 'architecture'  // 건축/공간
  | 'product'       // 제품
  | 'food'          // 음식
  | 'street'        // 거리/도시
  | 'abstract'      // 추상/개념

/**
 * classifySubject — 프롬프트에서 피사체 유형 자동 감지 (순수 함수)
 *
 * 패턴 우선순위: portrait > landscape > architecture > food > street > product > abstract
 */
export const classifySubject = (prompt: string): SubjectType => {
  const p = prompt.toLowerCase()
  if (/person|girl|boy|woman|man|face|사람|여자|남자|얼굴|인물|소녀|소년|아이|portrait/.test(p))
    return 'portrait'
  if (/mountain|forest|ocean|sea|sky|nature|field|lake|river|산|숲|바다|하늘|자연|들판|강|호수|나무/.test(p))
    return 'landscape'
  if (/building|architecture|city|room|interior|café|cafe|건물|도시|방|인테리어|카페|공간|집|계단/.test(p))
    return 'architecture'
  if (/food|meal|dish|cake|coffee|bread|음식|요리|케이크|커피|밥|빵|디저트|라떼/.test(p))
    return 'food'
  if (/street|alley|market|crowd|골목|거리|시장|사람들/.test(p))
    return 'street'
  if (/product|bottle|watch|perfume|ring|jewelry|제품|향수|시계|반지|물건/.test(p))
    return 'product'
  return 'abstract'
}

// ── 구도 가이드 사전 — 피사체별 전문 컴포지션 ────────────

const COMPOSITION_GUIDE: Readonly<Record<SubjectType, string>> = {
  portrait:     'rule of thirds, subject soft-lit foreground, complementary background separation, natural candid expression, intimate framing',
  landscape:    'sweeping panoramic depth, foreground texture interest, leading lines to horizon, layered atmospheric perspective',
  architecture: 'vanishing point symmetry, strong geometric lines, material texture detail, scale-revealing composition',
  product:      'clean hero shot angle, seamless negative space, three-quarter view, surface detail macro',
  food:         '45-degree hero angle, garnish texture focal point, moody negative space, steam or condensation detail',
  street:       'decisive moment, environmental storytelling, human element scale, depth of corridor perspective',
  abstract:     'visual tension balance, color weight harmony, rhythm and repetition, focal anchor point',
}

// ── 카메라 스펙 사전 — 피사체별 최적 촬영 파라미터 ─────────

const CAMERA_SPEC: Readonly<Record<SubjectType, string>> = {
  portrait:     '85mm f/1.4 portrait lens, Canon 5D Mark IV, ISO 200, beautiful bokeh background separation',
  landscape:    'Sony A7R V 24mm wide angle, f/11, ISO 100, tripod stability, golden hour maximum depth',
  architecture: 'Nikon D850 17mm tilt-shift, f/8, geometric perspective correction, HDR detail recovery',
  product:      '100mm macro f/16, studio strobe, perfect exposure, zero barrel distortion',
  food:         '50mm f/2.8, natural diffused window light, warm color temperature 5500K',
  street:       'Leica M11 35mm f/2, 1/500s fast shutter, available light documentary',
  abstract:     'Hasselblad X2D medium format, maximum technical resolution, analytical precision',
}

// ── 아트 디렉션 어휘 사전 — 스타일별 시각 언어 ──────────────

const ART_DIRECTION: Readonly<Record<string, string>> = {
  arha:       'Kodak Portra 400 film emulation, analog grain warmth, subtle lens vignette, romantic light leak, intimate atmospheric haze',
  photo:      'photojournalistic color truth, Magnum Photos aesthetic, honest available light, documentary realism',
  anime:      'Studio Ghibli warmth palette, cel shading luminosity, expressive linework, painterly sky gradient, vibrant color harmony',
  watercolor: 'wet-on-wet color bleeding, pigment granulation texture, luminous paper glow, transparent wash layers',
  oil:        'impasto paint texture, Rembrandt chiaroscuro, varnished surface depth, old master color richness',
  sketch:     'HB to 6B pencil gradation, cross-hatching shadow depth, paper grain texture, gestural marks',
}

// ── ARHA 시각적 서명 — 고유 미학 정체성 ─────────────────────

const ARHA_SIGNATURE =
  'quiet poetic atmosphere, melancholic beauty, soft light scatter, timeless nostalgic mood, emotional resonance'

// ── Expression Visual Grammar — 함수언어체계 expressionMode → 카메라 문법 매핑 ──
// 채팅 expressionMode가 영상 비주얼 언어로 이식되는 핵심 브릿지
// buildSeriesVideoPrompt에서 consistencyAnchor와 함께 주입됨

export const EXPRESSION_VISUAL_MAP: Readonly<Record<string, string>> = {
  SOFT_WARMTH:     'slow dolly-in, natural warm light, Kodak Portra warmth, intimate medium framing, gentle atmospheric softness',
  DEEP_EMPATHY:    'slow push-in, rack focus to eyes, muted warm palette, weighted stillness, close-up emotional presence, Terrence Malick mood',
  INTENSE_JOY:     'handheld kinetic energy, saturated bright palette, burst motion, quick environmental cut implied, golden dynamic light',
  ANALYTIC_THINK:  'static locked-off frame, symmetrical balanced composition, cool neutral palette, sharp clinical clarity, no camera movement',
  REFLECTIVE_GROW: 'slow pull-back reveal, golden hour backlight, shallow focus foreground, temporal atmospheric haze, past-tense visual poetry',
  PLAYFUL_TEASE:   'slightly tilted dutch angle, playful reframe, high contrast punchy colors, unexpected perspective, light bounce energy',
  SERENE_SMILE:    'gentle imperceptible drift, wide open negative space, soft diffused light, pastel muted tones, breathable composition',
}

// ── 비디오 모션 사전 — 피사체별 카메라 움직임 ───────────────

const VIDEO_MOTION: Readonly<Record<SubjectType, string>> = {
  portrait:     'slow cinematic push-in, rack focus background to subject, natural ambient movement',
  landscape:    'slow aerial drift, time-lapse cloud progression, golden hour light shift',
  architecture: 'architectural reveal pan, crane elevation, scale discovery movement',
  product:      'elegant 360 product rotation, caustic light play, detail macro exploration',
  food:         'steam rising close-up, condensation macro, intimate reveal pull-back',
  street:       'observational tracking walk, ambient city rhythm, candid life moment',
  abstract:     'fluid morphing transition, color bloom evolution, rhythm pulse',
}

// ── 원자적 변환기들 (단일 책임) ───────────────────────────

/** ARHA 시각적 관점 프레임 — 전체 미학 맥락 설정 */
export const withArhaPersona: PromptTransformer = p =>
  `ARHA visual aesthetic, Korean poetic sensibility, emotionally resonant: ${p}`

/** 스타일 suffix 추가 */
export const withStyleSuffix = (suffix: string): PromptTransformer => p =>
  suffix ? `${p}, ${suffix}` : p

/** 전문 품질 부스터 */
export const withQualityBoost: PromptTransformer = p =>
  `${p}, professional production quality, technically flawless, expert post-processing`

/** 영화적 조명 — 기존 호환용 */
export const withCinematicLighting: PromptTransformer = p =>
  `${p}, cinematic Rembrandt lighting, intentional shadow depth, golden hour quality`

/** 선명도 강화 — 기존 호환용 */
export const withSharpFocus: PromptTransformer = p =>
  `${p}, tack sharp focus, ultra detailed, 8K resolution`

/** 항등 변환 — 파이프라인 자리 채움용 */
export const identityTransformer: PromptTransformer = p => p

// ── 신규 변환기 팩토리들 ──────────────────────────────────

/** 피사체 기반 구도 가이드 주입 */
export const withSubjectComposition = (subject: SubjectType): PromptTransformer => p =>
  `${p}, ${COMPOSITION_GUIDE[subject]}`

/** 피사체 기반 카메라 스펙 주입 */
export const withCameraSpec = (subject: SubjectType): PromptTransformer => p =>
  `${p}, ${CAMERA_SPEC[subject]}`

/** 스타일별 아트 디렉션 어휘 주입 */
export const withArtDirection = (style: string): PromptTransformer => p =>
  `${p}, ${ART_DIRECTION[style] ?? ART_DIRECTION.arha}`

/** ARHA 고유 시각 서명 주입 */
export const withArhaSignature: PromptTransformer = p =>
  `${p}, ${ARHA_SIGNATURE}`

/** 영상 모션 디렉션 주입 */
export const withVideoMotion = (subject: SubjectType): PromptTransformer => p =>
  `${p}, ${VIDEO_MOTION[subject]}`

/** expressionMode 기반 카메라 문법 주입 — 함수언어체계 브릿지 */
export const withExpressionVisual = (expressionMode?: string): PromptTransformer => p =>
  expressionMode && EXPRESSION_VISUAL_MAP[expressionMode]
    ? `${p}, ${EXPRESSION_VISUAL_MAP[expressionMode]}`
    : p

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
  readonly type:   'brighten' | 'darken' | 'colorize' | 'add' | 'remove' | 'style' | 'sharpen' | 'blur' | 'generic'
  readonly label:  string
  readonly suffix: string
}

/** 사용자 요청 텍스트 → RefinementIntent (순수 함수, 로컬 패턴 매칭) */
export const detectRefinementIntent = (request: string): RefinementIntent => {
  const r = request.toLowerCase()
  if (/밝|bright|lighter|환하|high.?key/.test(r))
    return { type: 'brighten',  label: '밝기 증가',   suffix: ', brighter exposure, high key lighting, luminous' }
  if (/어둡|dark|dim|low.?key|무거/.test(r))
    return { type: 'darken',    label: '어두운 톤',   suffix: ', darker mood, low key lighting, deep shadows' }
  if (/색감|컬러|color|vivid|선명|채도|saturate/.test(r))
    return { type: 'colorize',  label: '색감 강화',   suffix: ', vivid colors, high saturation, color grading' }
  if (/선명|sharp|focus|또렷/.test(r))
    return { type: 'sharpen',   label: '선명도 강화', suffix: ', tack sharp, ultra detailed, crisp edges' }
  if (/흐리|blur|bokeh|아웃포커/.test(r))
    return { type: 'blur',      label: '아웃포커스',  suffix: ', shallow depth of field, beautiful bokeh, f/1.4' }
  if (/추가|넣어|add|포함|넣고/.test(r))
    return { type: 'add',       label: '요소 추가',   suffix: `, ${request}` }
  if (/제거|없애|remove|빼|삭제/.test(r))
    return { type: 'remove',    label: '요소 제거',   suffix: `, without ${request}, remove ${request}` }
  if (/스타일|느낌|style|분위기|톤/.test(r))
    return { type: 'style',     label: '스타일 변경', suffix: `, ${request} style, ${request} atmosphere` }
  return { type: 'generic',     label: '일반 보정',   suffix: `, ${request}` }
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
 * buildImagePrompt v2 — 전문 스튜디오급 이미지 프롬프트 파이프라인
 *
 * 1. 피사체 자동 감지 (classifySubject)
 * 2. 스타일 suffix → 구도 가이드 → 카메라 스펙 → 아트 디렉션
 * 3. ARHA 시각 서명 → 페르소나 프레임 → 품질 강화 → 보정 레이어
 */
export const buildImagePrompt = (opts: ImagePromptOptions): PromptTransformer =>
  (rawPrompt: string) => {
    const subject = classifySubject(rawPrompt)
    return pipe(
      withStyleSuffix(STYLE_SUFFIX[opts.style] ?? ''),
      withSubjectComposition(subject),
      withCameraSpec(subject),
      withArtDirection(opts.style),
      withArhaSignature,
      withArhaPersona,
      withQualityBoost,
      ...opts.refinements.map(withRefinement),
    )(rawPrompt)
  }

/**
 * buildVideoPrompt v2 — 피사체 인식 기반 영상 프롬프트 파이프라인
 *
 * 피사체 감지 → 영화적 조명 → 모션 디렉션 → ARHA 아트 디렉션
 */
export const buildVideoPrompt: PromptTransformer = (rawPrompt: string) => {
  const subject = classifySubject(rawPrompt)
  return pipe(
    withArhaPersona,
    withCinematicLighting,
    withVideoMotion(subject),
    withArtDirection('arha'),
    withQualityBoost,
  )(rawPrompt)
}
