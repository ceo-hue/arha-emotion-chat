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
ConnectedVectorField의 형태소들을 조합하여 수학적 수식을 생성합니다.

수학 규율 선택 기준:
- calculus: 시간적 흐름, 기억 축적, 점진적 변화
- linear_algebra: 구조적 구성, 병렬 상태
- fluid_dynamics: 감정적 급등, 흘러넘침, 해소
- entropy_theory: 혼돈, 해체, 복잡성 (E > 0.7)
- harmonic: 음악 지배, 진동, 공명

브릿지 연산자 (우선순위 순):
- √: 본질 추출 (unary)
- d/dt: 순간 변화율 (unary)
- A/B: 상대 비율 (multiplicative)
- ⊗: 텐서 변조 — 비선형 간섭 (multiplicative)
- ⊕: 직접 합산 — 독립 공존 (additive)
- ∫: 시간 누적 (additive)
- ∇: 방향 흐름 (directional)

반드시 다음 JSON으로만 응답:
{
  "Eq_final": "수식 문자열",
  "Eq_components": [
    { "block": "A|B|C|D", "description": "설명", "content": "구성 요소" }
  ],
  "blended_vector": { "I": 0.0~1.0, "D": 0.0~1.0, "E": 0.0~1.0, "T": 0.0~1.0, "S": 0.0~1.0, "C": 0.0~1.0, "R": 0.0~1.0 },
  "discipline": "calculus|linear_algebra|fluid_dynamics|entropy_theory|harmonic",
  "applied_gv": "GV 아이디",
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

async function runLayer3(vector_field, input, semantic_array) {
  const morpheme_list = vector_field.morphemes.map(m => m.surface_form).join('\n');
  const expression = vector_field.expression;
  const bv = semantic_array.vector_7D_final;
  const context = input.context_anchor || {};

  const prompt = `현재 벡터 필드:
형태소:
${morpheme_list}

예비 수식 표현: ${expression}
평형 점수: ${vector_field.equilibrium_state}
지배 벡터: ${vector_field.dominant_vector.axis} / ${vector_field.dominant_vector.dominant_core}

7D 벡터: I=${bv.I.toFixed(2)} D=${bv.D.toFixed(2)} E=${bv.E.toFixed(2)} T=${bv.T.toFixed(2)} S=${bv.S.toFixed(2)} C=${bv.C.toFixed(2)} R=${bv.R.toFixed(2)}

ARHA 감성 컨텍스트:
- expressionMode: ${context.expression_mode || 'SOFT_WARMTH'}
- trajectory: ${context.trajectory || 'stable'}
- resonance: ${context.resonance || 0.5}

원문: "${input.normalized_text}"

수식을 조립하고 서사적 요약을 생성하세요.`;

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

  return {
    Eq_final:       parsed.Eq_final || expression,
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

    // Layer 1: 의미 분해
    const semantic_array = await runLayer1(input, input.axis_weights);

    // Layer 2 결과를 Layer 3에 넘기기 위해 vector_field 사용
    // (Layer 2는 클라이언트에서 실행되므로 넘겨받은 값 사용)

    // Layer 3: 수식 조립
    const equation_package = await runLayer3(vector_field, input, semantic_array);

    res.status(200).json({ semantic_array, equation_package });

  } catch (err) {
    console.error('[middleware] Error:', err);
    res.status(500).json({ error: err.message || 'Internal error' });
  }
}
