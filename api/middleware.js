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

  const prompt = `의미 단위 분석 결과:
축별 기본 단위 (Layer 1 실제 분석값):
${l1_morphemes.join('\n')}

활성화된 축: ${axis_summary || 'emotion(0.80)'}
7D 벡터: I=${bv.I.toFixed(2)} D=${bv.D.toFixed(2)} E=${bv.E.toFixed(2)} T=${bv.T.toFixed(2)} S=${bv.S.toFixed(2)} C=${bv.C.toFixed(2)} R=${bv.R.toFixed(2)}

ARHA 감성 컨텍스트:
- expressionMode: ${context.expression_mode || 'SOFT_WARMTH'}
- trajectory: ${context.trajectory || 'stable'}
- resonance: ${context.resonance || 0.5}

원문: "${input.normalized_text}"

위 단위들을 조합하여 지배방정식(Eq_final)을 조립하세요.
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

  return {
    Eq_final:       parsed.Eq_final || fallback_eq,
    Eq_components:  parsed.Eq_components || [],
    blended_vector: parsed.blended_vector || bv,
    discipline:     parsed.discipline || 'calculus',
    applied_gv:     parsed.applied_gv || 'GV_ARHA_Conversation',
    blend_log:      parsed.blend_log || [],
    meta_block:     parsed.meta_block || {
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

  return { morphemes, expression, sub_vector_field, dominant_vector, equilibrium_state: Math.max(0, 1 - variance * 2) };
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
