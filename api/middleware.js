/**
 * /api/middleware — ARHA 함수언어 미들웨어 서버 엔드포인트
 * Layer 1 (의미 분해) + Layer 3 (수식 조립)을 Claude API로 처리
 *
 * POST /api/middleware
 * Body: { input: InputObject, vector_field: ConnectedVectorField }
 * Response: { semantic_array: SemanticUnitArray, equation_package: VerifiedEquationPackage }
 */

import Anthropic from '@anthropic-ai/sdk';

export const config = { maxDuration: 60 };

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// ─────────────────────────────────────────
// 골든벡터 (GV) 정의 — constants.ts 동기화
// ─────────────────────────────────────────

const GOLDEN_VECTORS = {
  // ── 도메인 계층 (Domain) ──
  GV_ARHA_Conversation: {
    base_vector:        { I: 0.65, D: 0.60, E: 0.35, T: 0.50, S: 0.75, C: 0.80, R: 0.60 },
    blend_ratio:        0.85,
    axis_bias:          { emotion: 0.90, relation: 0.80, rhythm: 0.70 },
    personality_vectors: ['warm', 'empathetic', 'resonant', 'sincere'],
    quality_floor:      0.65,
  },
  GV_Cinematic_Noir_v2: {
    base_vector:        { I: 0.78, D: 0.72, E: 0.40, T: 0.65, S: 0.40, C: 0.75, R: 0.45 },
    blend_ratio:        0.90,
    axis_bias:          { visual: 0.95, video: 0.85, physics: 0.60 },
    personality_vectors: ['cinematic', 'atmospheric', 'moody', 'precise'],
    quality_floor:      0.70,
  },
  GV_Cinematic_Noir_v1: {
    base_vector:        { I: 0.72, D: 0.68, E: 0.42, T: 0.60, S: 0.42, C: 0.70, R: 0.48 },
    blend_ratio:        0.80,
    axis_bias:          { visual: 0.88, video: 0.78 },
    personality_vectors: ['cinematic', 'moody'],
    quality_floor:      0.65,
  },
  GV_Code_Generation: {
    base_vector:        { I: 0.92, D: 0.85, E: 0.15, T: 0.40, S: 0.30, C: 0.95, R: 0.25 },
    blend_ratio:        0.95,
    axis_bias:          { state: 0.95, rhythm: 0.60 },
    personality_vectors: ['precise', 'structured', 'minimal', 'efficient'],
    quality_floor:      0.75,
  },
  GV_Design_Spring: {
    base_vector:        { I: 0.75, D: 0.65, E: 0.45, T: 0.55, S: 0.60, C: 0.78, R: 0.50 },
    blend_ratio:        0.85,
    axis_bias:          { visual: 0.90, relation: 0.65 },
    personality_vectors: ['aesthetic', 'balanced', 'creative', 'harmonic'],
    quality_floor:      0.68,
  },
  GV_Research: {
    base_vector:        { I: 0.88, D: 0.80, E: 0.25, T: 0.50, S: 0.35, C: 0.90, R: 0.40 },
    blend_ratio:        0.90,
    axis_bias:          { state: 0.88, relation: 0.55 },
    personality_vectors: ['analytical', 'thorough', 'objective', 'structured'],
    quality_floor:      0.72,
  },
  GV_Technical_Design: {
    base_vector:        { I: 0.85, D: 0.78, E: 0.22, T: 0.45, S: 0.55, C: 0.88, R: 0.38 },
    blend_ratio:        0.88,
    axis_bias:          { state: 0.90, visual: 0.75 },
    personality_vectors: ['precise', 'elegant', 'functional'],
    quality_floor:      0.70,
  },
  GV_System_Default: {
    base_vector:        { I: 0.70, D: 0.65, E: 0.35, T: 0.50, S: 0.50, C: 0.70, R: 0.50 },
    blend_ratio:        0.70,
    axis_bias:          {},
    personality_vectors: ['balanced'],
    quality_floor:      0.60,
  },

  // ── 감성 계층 (Emotional Tier) ──
  GV_Melancholic_Depth: {
    base_vector:        { I: 0.60, D: 0.82, E: 0.28, T: 0.72, S: 0.30, C: 0.65, R: 0.45 },
    blend_ratio:        0.88,
    axis_bias:          { emotion: 0.92, state: 0.80, rhythm: 0.65 },
    personality_vectors: ['melancholic', 'introspective', 'heavy', 'silent', 'layered'],
    quality_floor:      0.68,
  },
  GV_Serene_Clarity: {
    base_vector:        { I: 0.80, D: 0.55, E: 0.20, T: 0.40, S: 0.45, C: 0.90, R: 0.35 },
    blend_ratio:        0.85,
    axis_bias:          { state: 0.88, emotion: 0.65, visual: 0.72 },
    personality_vectors: ['serene', 'clear', 'minimal', 'precise', 'cool'],
    quality_floor:      0.70,
  },
  GV_Euphoric_Surge: {
    base_vector:        { I: 0.85, D: 0.70, E: 0.65, T: 0.75, S: 0.60, C: 0.55, R: 0.50 },
    blend_ratio:        0.90,
    axis_bias:          { emotion: 0.95, physics: 0.75, video: 0.80 },
    personality_vectors: ['euphoric', 'intense', 'explosive', 'dynamic', 'overwhelming'],
    quality_floor:      0.65,
  },
  GV_Tender_Warmth: {
    base_vector:        { I: 0.68, D: 0.62, E: 0.30, T: 0.52, S: 0.80, C: 0.78, R: 0.65 },
    blend_ratio:        0.86,
    axis_bias:          { emotion: 0.88, relation: 0.85, rhythm: 0.72 },
    personality_vectors: ['tender', 'warm', 'gentle', 'intimate', 'soft'],
    quality_floor:      0.68,
  },
  GV_Fierce_Resolve: {
    base_vector:        { I: 0.90, D: 0.80, E: 0.18, T: 0.45, S: 0.35, C: 0.92, R: 0.28 },
    blend_ratio:        0.92,
    axis_bias:          { state: 0.92, emotion: 0.78, physics: 0.65 },
    personality_vectors: ['fierce', 'resolute', 'grounded', 'focused', 'unwavering'],
    quality_floor:      0.72,
  },
  GV_Nostalgic_Haze: {
    base_vector:        { I: 0.55, D: 0.75, E: 0.42, T: 0.80, S: 0.42, C: 0.60, R: 0.55 },
    blend_ratio:        0.84,
    axis_bias:          { emotion: 0.85, state: 0.75, rhythm: 0.70, visual: 0.65 },
    personality_vectors: ['nostalgic', 'hazy', 'bittersweet', 'dreamy', 'faded'],
    quality_floor:      0.65,
  },

  // ── 시각/시네마 계층 (Visual/Cinematic Tier) ──
  GV_Soft_Natural_Light: {
    base_vector:        { I: 0.70, D: 0.60, E: 0.35, T: 0.55, S: 0.55, C: 0.75, R: 0.48 },
    blend_ratio:        0.87,
    axis_bias:          { visual: 0.92, emotion: 0.72, rhythm: 0.68 },
    personality_vectors: ['golden_hour', 'soft_diffused', 'warm_tones', 'natural', 'organic'],
    quality_floor:      0.68,
  },
  GV_High_Contrast_Drama: {
    base_vector:        { I: 0.85, D: 0.78, E: 0.45, T: 0.62, S: 0.38, C: 0.72, R: 0.40 },
    blend_ratio:        0.91,
    axis_bias:          { visual: 0.95, video: 0.82, physics: 0.65 },
    personality_vectors: ['high_contrast', 'dramatic', 'chiaroscuro', 'bold', 'sharp'],
    quality_floor:      0.70,
  },
  GV_Abstract_Texture: {
    base_vector:        { I: 0.65, D: 0.85, E: 0.50, T: 0.40, S: 0.30, C: 0.65, R: 0.45 },
    blend_ratio:        0.84,
    axis_bias:          { visual: 0.90, physics: 0.70, music: 0.55 },
    personality_vectors: ['textured', 'abstract', 'tactile', 'layered', 'complex'],
    quality_floor:      0.65,
  },
  GV_Noir_Minimalism: {
    base_vector:        { I: 0.75, D: 0.50, E: 0.32, T: 0.55, S: 0.25, C: 0.82, R: 0.38 },
    blend_ratio:        0.89,
    axis_bias:          { visual: 0.93, state: 0.75, emotion: 0.65 },
    personality_vectors: ['noir', 'minimal', 'sparse', 'shadowed', 'silent'],
    quality_floor:      0.70,
  },
  GV_Dreamlike_Diffusion: {
    base_vector:        { I: 0.52, D: 0.68, E: 0.55, T: 0.62, S: 0.48, C: 0.58, R: 0.52 },
    blend_ratio:        0.83,
    axis_bias:          { visual: 0.88, emotion: 0.75, state: 0.65 },
    personality_vectors: ['dreamlike', 'diffused', 'ethereal', 'blurred', 'liminal'],
    quality_floor:      0.63,
  },

  // ── 시간성 계층 (Temporal Tier) ──
  GV_Slow_Accumulation: {
    base_vector:        { I: 0.62, D: 0.78, E: 0.30, T: 0.88, S: 0.48, C: 0.72, R: 0.50 },
    blend_ratio:        0.86,
    axis_bias:          { emotion: 0.80, state: 0.78, rhythm: 0.85 },
    personality_vectors: ['accumulative', 'patient', 'layering', 'gradual', 'deep'],
    quality_floor:      0.67,
  },
  GV_Moment_Crystallized: {
    base_vector:        { I: 0.88, D: 0.72, E: 0.22, T: 0.25, S: 0.40, C: 0.88, R: 0.35 },
    blend_ratio:        0.88,
    axis_bias:          { visual: 0.88, emotion: 0.80, state: 0.85 },
    personality_vectors: ['crystallized', 'frozen', 'precise', 'sharp', 'eternal_instant'],
    quality_floor:      0.70,
  },
  GV_Eternal_Loop: {
    base_vector:        { I: 0.65, D: 0.70, E: 0.38, T: 0.78, S: 0.55, C: 0.75, R: 0.60 },
    blend_ratio:        0.84,
    axis_bias:          { rhythm: 0.90, state: 0.75, music: 0.78 },
    personality_vectors: ['cyclical', 'hypnotic', 'meditative', 'repetitive', 'grounding'],
    quality_floor:      0.65,
  },
  GV_Rapid_Cascade: {
    base_vector:        { I: 0.82, D: 0.65, E: 0.60, T: 0.85, S: 0.45, C: 0.55, R: 0.48 },
    blend_ratio:        0.90,
    axis_bias:          { video: 0.90, physics: 0.80, rhythm: 0.85 },
    personality_vectors: ['rapid', 'cascading', 'breathless', 'kinetic', 'urgent'],
    quality_floor:      0.65,
  },
};

// 모달리티 → GV 우선순위
const MODALITY_GV_PRIORITY = {
  video:   ['GV_Cinematic_Noir_v2', 'GV_High_Contrast_Drama',  'GV_Rapid_Cascade',       'GV_System_Default'],
  image:   ['GV_Cinematic_Noir_v2', 'GV_Soft_Natural_Light',   'GV_Noir_Minimalism',     'GV_System_Default'],
  music:   ['GV_ARHA_Conversation', 'GV_Eternal_Loop',         'GV_Slow_Accumulation',   'GV_System_Default'],
  code:    ['GV_Code_Generation',   'GV_Technical_Design',     'GV_Serene_Clarity',      'GV_System_Default'],
  design:  ['GV_Design_Spring',     'GV_Abstract_Texture',     'GV_Dreamlike_Diffusion', 'GV_System_Default'],
  plan:    ['GV_Research',          'GV_ARHA_Conversation',    'GV_Fierce_Resolve',      'GV_System_Default'],
  default: ['GV_ARHA_Conversation', 'GV_System_Default'],
};

// expressionMode → 감성 계층 GV 자동 매핑
const EXPRESSION_MODE_GV_MAP = {
  DEEP_EMPATHY:      'GV_Tender_Warmth',
  SOFT_WARMTH:       'GV_Tender_Warmth',
  SURGE_OVERRIDE:    'GV_Euphoric_Surge',
  MELANCHOLIC_DEPTH: 'GV_Melancholic_Depth',
  COOL_CLARITY:      'GV_Serene_Clarity',
  STABLE_NEUTRAL:    'GV_System_Default',
  CREATIVE_FLOW:     'GV_Dreamlike_Diffusion',
  INTENSE_JOY:       'GV_Euphoric_Surge',
  ANALYTIC_THINK:    'GV_Serene_Clarity',
  REFLECTIVE_GROW:   'GV_Nostalgic_Haze',
  PLAYFUL_TEASE:     'GV_Rapid_Cascade',
  SERENE_SMILE:      'GV_Soft_Natural_Light',
};

/** Claude가 고른 GV + expressionMode + 모달리티 우선순위로 최종 GV 결정 */
function resolveGV(claude_gv_id, target_modalities, expression_mode) {
  // expressionMode → 감성 계층 GV 우선
  if (expression_mode && EXPRESSION_MODE_GV_MAP[expression_mode]) {
    return EXPRESSION_MODE_GV_MAP[expression_mode];
  }
  // Claude가 유효한 GV를 골랐으면 그것 우선
  if (claude_gv_id && GOLDEN_VECTORS[claude_gv_id]) return claude_gv_id;
  // 없으면 모달리티 기반 우선순위
  const primary = target_modalities?.[0];
  const priority = MODALITY_GV_PRIORITY[primary] || MODALITY_GV_PRIORITY.default;
  return priority[0];
}

/** GV base_vector를 equation blended_vector에 블렌딩 */
function applyGVBlend(blended_vector, gv_id) {
  const gv = GOLDEN_VECTORS[gv_id] || GOLDEN_VECTORS.GV_System_Default;
  const bv = gv.base_vector;
  const br = gv.blend_ratio;       // GV 블렌드 비율
  const cr = 1 - (br * 0.25);      // Claude 결과 비중 (GV를 최대 25% 반영)

  return {
    I: blended_vector.I * cr + bv.I * (1 - cr),
    D: blended_vector.D * cr + bv.D * (1 - cr),
    E: blended_vector.E * cr + bv.E * (1 - cr),
    T: blended_vector.T * cr + bv.T * (1 - cr),
    S: blended_vector.S * cr + bv.S * (1 - cr),
    C: blended_vector.C * cr + bv.C * (1 - cr),
    R: blended_vector.R * cr + bv.R * (1 - cr),
  };
}

// ─────────────────────────────────────────
// Layer 1: 7D 의미 분해 (Claude)
// ─────────────────────────────────────────

const LAYER1_SYSTEM = `당신은 ARHA 함수언어 미들웨어의 Layer 1 프로세서입니다.
자연어 입력을 8개의 의미 축(emotion/visual/rhythm/state/relation/video/physics/music)으로 분해하고
각 단위에 7D 벡터값(I, D, E)을 할당합니다.

반드시 다음 JSON 형식으로만 응답하세요:
{
  "subject_context": ["string"],
  "semantic_units": [
    {
      "raw_text": "원문 표현",
      "semantic_core": "English semantic core",
      "axis": "emotion|visual|rhythm|state|relation|video|physics|music",
      "dimension_anchor": "ST|TM|RL|SP|NV|EX",
      "I": 0.0~1.0,
      "D": 0.0~1.0,
      "E": 0.0~1.0,
      "confidence": 0.0~1.0
    }
  ],
  "vector_7D_final": {
    "I": 0.0~1.0, "D": 0.0~1.0, "E": 0.0~1.0,
    "T": 0.0~1.0, "S": 0.0~1.0, "C": 0.0~1.0, "R": 0.0~1.0
  },
  "mu_memory": 0.0~1.0
}

7D 벡터 의미:
- I (Information/Certainty): 표현의 확신도와 정보 밀도
- D (semantic Density): 의미 농밀도
- E (Entropy): 불확실성과 열린 가능성
- T (Temporality): 시간적 흐름 강도
- S (Sociality): 사회적/관계적 차원
- C (Coherence): 맥락 일관성
- R (Relativity): 상대적 맥락 의존도

차원 앵커 (dimension_anchor):
- ST: 내부 심리 상태
- TM: 시간적 흐름
- RL: 대인관계 역학
- SP: 물리적 공간
- NV: 비언어 (소리/음악)
- EX: 힘/흐름/표현`;

async function runLayer1(input, axis_weights) {
  const prompt = `텍스트: "${input.normalized_text}"
언어: ${input.lang_flag}
이모지: ${input.emoji_signals.join(' ')}
도메인: ${input.domain.join(', ')}
ARHA 감성 컨텍스트: ${JSON.stringify(input.context_anchor || {})}
현재 축 가중치: ${JSON.stringify(axis_weights)}
이전 세션 xi_weight: ${input.xi_weight}

위 텍스트를 분석하여 의미 단위로 분해하세요.`;

  const msg = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 2000,
    system: LAYER1_SYSTEM,
    messages: [{ role: 'user', content: prompt }],
  });

  const text = msg.content[0]?.text || '{}';
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error('Layer 1: No JSON in response');
  const parsed = JSON.parse(jsonMatch[0]);

  return {
    subject_context:    parsed.subject_context || [],
    semantic_units:     parsed.semantic_units || [],
    axis_activation_map: axis_weights,
    vector_7D_final:    parsed.vector_7D_final || { I:0.7, D:0.65, E:0.35, T:0.5, S:0.5, C:0.7, R:0.5 },
    mu_memory:          parsed.mu_memory || 0,
    constraint_log:     [],
    cross_effect_log:   [],
  };
}

// ─────────────────────────────────────────
// Layer 3: 수식 조립 (Claude)
// ─────────────────────────────────────────

const LAYER3_SYSTEM = `당신은 ARHA 함수언어 미들웨어의 Layer 3 수식 조립기입니다.
의미 단위들을 분석하여 ARHA 지배방정식(governing equation)을 조립합니다.

═══ 지배방정식 표기 규칙 (반드시 준수) ═══

축 함수 기호 (이것만 사용):
- 감성(emotion): Ψ(값,보조값)
- 시각(visual):  σ(L_g,C_θ) 또는 σ(D,S)
- 리듬(rhythm):  Φ(N=숫자)
- 상태(state):   Λ(∂ε→방향) 또는 Λ(Ω)
- 관계(relation): Θ(η,R)
- 영상(video):   M(v⃗,T_fps)
- 물리(physics): G(Fl,F)
- 음악(music):   Mel(H,R)

값 표기: I값 사용, 소수점 2자리. 예: Ψ(0.82,ρ)
보조값: 그리스 소문자 또는 약어. 예: ρ, η, ε

브릿지 연산자:
- ⊕ : 독립 공존 (기본, 다른 축 결합)
- ⊗ : 비선형 간섭 (같은 축 충돌)
- · : 곱 변조 (승수 관계)
- ∫ : 시간 누적 (TM 앵커)
- ∇ : 방향 흐름 (RL 앵커)
- d/dt : 순간 변화율 (변화 중)
- √ : 본질 추출 (E > 0.7)

올바른 예시:
"Ψ(0.74,ρ) ⊕ σ(L_g,C_θ) · Φ(N=7)"
"Ψ(0.82,ρ) ⊗ Λ(∂ε→calm) ⊕ σ(D_h,S_n)"
"∫[Ψ(0.65,ρ) · Λ(Ω)] ⊕ Φ(N=5)"

금지 사항:
- ƒ[...], ∨[...], f(...) 같은 임의 표기 사용 금지
- 중괄호 {I:..., D:...} 포맷 사용 금지 (Layer 2 내부 포맷임)
- 일반 수학식(sin, cos, ln 등) 단독 사용 금지
- 위 축 기호 외의 임의 기호 발명 금지

═══ JSON 응답 형식 ═══
{
  "Eq_final": "지배방정식 문자열 (위 규칙 엄수)",
  "Eq_components": [
    { "block": "A|B|C|D", "description": "설명", "content": "구성 요소" }
  ],
  "blended_vector": { "I": 0.0~1.0, "D": 0.0~1.0, "E": 0.0~1.0, "T": 0.0~1.0, "S": 0.0~1.0, "C": 0.0~1.0, "R": 0.0~1.0 },
  "discipline": "calculus|linear_algebra|fluid_dynamics|entropy_theory|harmonic",
  "applied_gv": "GV_ARHA_Conversation|GV_Cinematic_Noir_v2|GV_Code_Generation|GV_Design_Spring|GV_Research",
  "blend_log": ["string"],
  "meta_block": {
    "narrative_summary": "수식의 시적 서사 요약 (한국어, 1-2문장)",
    "confidence_score": 0.0~1.0,
    "discipline_confidence": 0.0~1.0
  },
  "audit_result": {
    "dimensional_consistency": true/false,
    "operator_validity": true/false,
    "constraint_satisfied": true/false,
    "issues": []
  }
}`;

// Layer 1 결과로 축별 표면 표기 생성 (Layer 2 서버측 간이 실행)
function buildMorphemeSurfaceFromSemanticArray(semantic_array) {
  const AXIS_SYMBOLS = {
    emotion: 'Ψ', visual: 'σ', rhythm: 'Φ', state: 'Λ',
    relation: 'Θ', video: 'M', physics: 'G', music: 'Mel',
  };
  const DIM_SECONDARY = { ST: 'ρ', TM: 'τ', RL: 'η', SP: 'γ', NV: 'ν', EX: 'ε' };

  return semantic_array.semantic_units.slice(0, 6).map(u => {
    const sym = AXIS_SYMBOLS[u.axis] || 'Ψ';
    const sec = DIM_SECONDARY[u.dimension_anchor] || 'ρ';
    return `${sym}(${u.I.toFixed(2)},${sec})`;  // 지배방정식 포맷
  });
}

async function runLayer3(vector_field, input, semantic_array) {
  // Layer 1 결과 기반 축별 단위 구성 (preliminary 하드코딩 대신 실제 분석값 사용)
  const l1_morphemes = buildMorphemeSurfaceFromSemanticArray(semantic_array);
  const bv = semantic_array.vector_7D_final;
  const context = input.context_anchor || {};

  // 축별 활성화 요약
  const axis_summary = Object.entries(semantic_array.axis_activation_map || {})
    .filter(([, v]) => v > 0.3)
    .sort(([, a], [, b]) => b - a)
    .map(([k, v]) => `${k}(${v.toFixed(2)})`)
    .join(', ');

  // 교집합 앵커 정보 (vector_field 파라미터에서 추출)
  const interference_info = (vector_field.interference_anchors || [])
    .slice(0, 3)
    .map(ia => `  [${ia.axis_a}∩${ia.axis_b}] cos=${ia.cosine_similarity.toFixed(2)} → 강제연산자:${ia.forced_operator} (중력:${ia.interference_gravity.toFixed(2)})`)
    .join('\n');

  const prompt = `의미 단위 분석 결과:
축별 기본 단위 (Layer 1 실제 분석값):
${l1_morphemes.join('\n')}

활성화된 축: ${axis_summary || 'emotion(0.80)'}
7D 벡터: I=${bv.I.toFixed(2)} D=${bv.D.toFixed(2)} E=${bv.E.toFixed(2)} T=${bv.T.toFixed(2)} S=${bv.S.toFixed(2)} C=${bv.C.toFixed(2)} R=${bv.R.toFixed(2)}
${interference_info ? `\n교집합 국소 앵커 (고중력 간섭 지점 — 이 연산자를 수식에 반드시 반영):\n${interference_info}` : ''}

ARHA 감성 컨텍스트:
- expressionMode: ${context.expression_mode || 'SOFT_WARMTH'}
- trajectory: ${context.trajectory || 'stable'}
- resonance: ${context.resonance || 0.5}

원문: "${input.normalized_text}"

위 단위들을 조합하여 지배방정식(Eq_final)을 조립하세요.
교집합 앵커가 있다면 해당 강제연산자(⊗/∫/∇)를 교집합 지점에 반드시 사용하세요.
반드시 Ψ, σ, Φ, Λ, Θ, M, G, Mel 기호와 ⊕, ⊗, ·, ∫, ∇ 연산자만 사용하세요.
중괄호 {I:..., D:...} 포맷은 절대 사용하지 마세요.`;

  const msg = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 2000,
    system: LAYER3_SYSTEM,
    messages: [{ role: 'user', content: prompt }],
  });

  const text = msg.content[0]?.text || '{}';
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error('Layer 3: No JSON in response');
  const parsed = JSON.parse(jsonMatch[0]);

  // 폴백 수식: Layer 1 결과의 첫 두 단위로 최소 지배방정식 구성
  const fallback_units = buildMorphemeSurfaceFromSemanticArray(semantic_array);
  const fallback_eq = fallback_units.length >= 2
    ? `${fallback_units[0]} ⊕ ${fallback_units[1]}`
    : (fallback_units[0] || 'Ψ(0.70,ρ) ⊕ Λ(∂ε)');

  // ── 골든벡터 블렌딩 ──
  // Claude가 고른 GV (or 모달리티 기반 결정) → blended_vector에 실제 반영
  const resolved_gv_id = resolveGV(
    parsed.applied_gv,
    input.target_modalities,
    (input.context_anchor || {}).expression_mode,
  );
  const raw_blended    = parsed.blended_vector || bv;
  const gv_blended     = applyGVBlend(raw_blended, resolved_gv_id);
  const gv             = GOLDEN_VECTORS[resolved_gv_id];

  return {
    Eq_final:       parsed.Eq_final || fallback_eq,
    Eq_components:  parsed.Eq_components || [],
    blended_vector: gv_blended,          // GV 반영된 최종 벡터
    discipline:     parsed.discipline || 'calculus',
    applied_gv:     resolved_gv_id,      // 실제 적용된 GV
    blend_log:      [
      ...(parsed.blend_log || []),
      `GV_applied: ${resolved_gv_id} (blend_ratio=${gv.blend_ratio}, personality=[${gv.personality_vectors.join(',')}])`,
    ],
    meta_block: parsed.meta_block || {
      narrative_summary: input.normalized_text,
      confidence_score: 0.65,
      discipline_confidence: 0.65,
    },
    audit_result: parsed.audit_result || {
      dimensional_consistency: true,
      operator_validity: true,
      constraint_satisfied: true,
      issues: [],
    },
  };
}

// ─────────────────────────────────────────
// 서버측 간이 Layer 2 — Layer 1 결과로 vector_field 재구성
// ─────────────────────────────────────────

function buildServerVectorField(semantic_array, input) {
  const AXIS_SYMBOLS = {
    emotion: 'Ψ', visual: 'σ', rhythm: 'Φ', state: 'Λ',
    relation: 'Θ', video: 'M', physics: 'G', music: 'Mel',
  };
  const DIM_SECONDARY = { ST: 'ρ', TM: 'τ', RL: 'η', SP: 'γ', NV: 'ν', EX: 'ε' };
  const BRIDGE_OPS = ['⊕', '⊗', '·', '∫', '∇'];

  const morphemes = semantic_array.semantic_units.slice(0, 6).map((u, i) => {
    const sym = AXIS_SYMBOLS[u.axis] || 'Ψ';
    const sec = DIM_SECONDARY[u.dimension_anchor] || 'ρ';
    return {
      id: `m_${i}`,
      surface_form: `${sym}(${u.I.toFixed(2)},${sec})`,
      base_function: sym,
      semantic_core: u.semantic_core,
      axis: u.axis,
      dimension_anchor: u.dimension_anchor,
      I: u.I, D: u.D, E: u.E,
      importance: (u.I + u.D) / 2 * u.confidence,
    };
  });

  // 중요도 내림차순 정렬 후 수식 표현 조립
  morphemes.sort((a, b) => b.importance - a.importance);
  const parts = [];
  morphemes.forEach((m, i) => {
    if (i > 0) {
      const prev = morphemes[i - 1];
      const op = prev.axis === m.axis ? '⊗'
        : m.dimension_anchor === 'TM' ? '∫'
        : '⊕';
      parts.push(op);
    }
    parts.push(m.surface_form);
  });
  const expression = parts.join(' ');

  // 축별 집계
  const byAxis = {};
  for (const m of morphemes) {
    if (!byAxis[m.axis]) byAxis[m.axis] = [];
    byAxis[m.axis].push(m);
  }
  const sub_vector_field = Object.entries(byAxis).map(([axis, ms]) => {
    const mag = ms.reduce((s, m) => s + m.importance, 0) / ms.length;
    const dominant = ms.reduce((a, b) => a.importance > b.importance ? a : b);
    return {
      id: `v_${axis}`, axis, morpheme_ids: ms.map(m => m.id),
      dominant_core: dominant.semantic_core,
      magnitude: Math.min(1.0, mag),
      tri_summary: {
        I: ms.reduce((s, m) => s + m.I, 0) / ms.length,
        D: ms.reduce((s, m) => s + m.D, 0) / ms.length,
        E: ms.reduce((s, m) => s + m.E, 0) / ms.length,
      },
      render_hint: { tone: dominant.semantic_core, density: 'medium', priority: mag },
    };
  });

  const dominant_vector = sub_vector_field.reduce((a, b) =>
    a.magnitude > b.magnitude ? a : b,
    sub_vector_field[0] || {
      id: 'v_emotion', axis: 'emotion', morpheme_ids: [], dominant_core: '',
      magnitude: 0, tri_summary: { I: 0.5, D: 0.5, E: 0.3 },
      render_hint: { tone: '', density: 'medium', priority: 0 },
    }
  );

  const mag_list = sub_vector_field.map(v => v.magnitude);
  const avg_mag = mag_list.reduce((s, v) => s + v, 0) / (mag_list.length || 1);
  const variance = mag_list.reduce((s, v) => s + (v - avg_mag) ** 2, 0) / (mag_list.length || 1);

  // ── 교집합 국소 앵커 감지 (layer2.ts detectInterferenceAnchors 동기화) ──
  const INTERFERENCE_THRESHOLD = 0.60;
  const INTERFERENCE_FACTOR    = 1.35;

  function cosineSim(a, b) {
    const dot   = a.I * b.I + a.D * b.D + a.E * b.E;
    const normA = Math.sqrt(a.I ** 2 + a.D ** 2 + a.E ** 2);
    const normB = Math.sqrt(b.I ** 2 + b.D ** 2 + b.E ** 2);
    if (normA === 0 || normB === 0) return 0;
    return dot / (normA * normB);
  }

  function midpoint7D(va, vb) {
    const ta = va.tri_summary, tb = vb.tri_summary;
    const wa = va.magnitude, wb = vb.magnitude, wt = wa + wb || 1;
    return {
      I: (ta.I * wa + tb.I * wb) / wt,
      D: (ta.D * wa + tb.D * wb) / wt,
      E: (ta.E * wa + tb.E * wb) / wt,
      T: 0.50,
      S: Math.min(wa, wb) / Math.max(wa, wb, 0.01),
      C: (ta.I * wa + tb.I * wb) / wt * 0.85,
      R: Math.abs(ta.I - tb.I) * 0.5,
    };
  }

  function selectInterfOp(axis_a, axis_b, cosine, va, vb) {
    const has_temporal = axis_a === 'state' || axis_b === 'state'
      || (va.tri_summary.T || 0) > 0.6 || (vb.tri_summary.T || 0) > 0.6;
    const has_relation = axis_a === 'relation' || axis_b === 'relation';
    if (has_temporal) return '∫';
    if (has_relation) return '∇';
    if (cosine > 0.65) return '⊗';
    return '⊕';
  }

  const AXIS_KO = { emotion:'감성', visual:'시각', rhythm:'리듬', state:'상태', relation:'관계', video:'영상', physics:'물리', music:'음악' };
  const interference_anchors = [];
  const pairs_seen = new Set();

  for (let i = 0; i < sub_vector_field.length; i++) {
    for (let j = i + 1; j < sub_vector_field.length; j++) {
      const va = sub_vector_field[i], vb = sub_vector_field[j];
      const pair_key = [va.axis, vb.axis].sort().join('|');
      if (pairs_seen.has(pair_key)) continue;
      pairs_seen.add(pair_key);

      const cosine = cosineSim(va.tri_summary, vb.tri_summary);
      if (cosine < INTERFERENCE_THRESHOLD) continue;

      const base_gravity = (0.6 + va.magnitude * 0.3 + 0.6 + vb.magnitude * 0.3) / 2;
      const interference_gravity = Math.min(1.0, base_gravity * INTERFERENCE_FACTOR);
      const forced_operator = selectInterfOp(va.axis, vb.axis, cosine, va, vb);
      const position = midpoint7D(va, vb);
      const name_a = AXIS_KO[va.axis] || va.axis;
      const name_b = AXIS_KO[vb.axis] || vb.axis;

      interference_anchors.push({
        id:                 `ia_${va.axis}_${vb.axis}`,
        axis_a:             va.axis,
        axis_b:             vb.axis,
        position,
        cosine_similarity:  cosine,
        interference_gravity,
        forced_operator,
        narrative:          `${name_a}과 ${name_b}이 ${(cosine * 100).toFixed(0)}% 교집합 — 국소 앵커 형성`,
      });
    }
  }
  interference_anchors.sort((a, b) => b.interference_gravity - a.interference_gravity);

  return { morphemes, expression, sub_vector_field, dominant_vector, equilibrium_state: Math.max(0, 1 - variance * 2), interference_anchors };
}

// ─────────────────────────────────────────
// 핸들러
// ─────────────────────────────────────────

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { input, vector_field } = req.body;

    if (!input || !vector_field) {
      return res.status(400).json({ error: 'Missing input or vector_field' });
    }

    // Layer 1: 의미 분해 (Claude)
    const semantic_array = await runLayer1(input, input.axis_weights);

    // Layer 2 서버측 간이 실행: Layer 1 결과로 vector_field 재구성
    // (클라이언트가 넘긴 preliminary vector_field 대신 실제 분석 기반 사용)
    const server_vector_field = buildServerVectorField(semantic_array, input);

    // Layer 3: 수식 조립 (Claude) — 실제 분석 기반 vector_field 사용
    const equation_package = await runLayer3(server_vector_field, input, semantic_array);

    res.status(200).json({ semantic_array, equation_package });

  } catch (err) {
    console.error('[middleware] Error:', err);
    res.status(500).json({ error: err.message || 'Internal error' });
  }
}
