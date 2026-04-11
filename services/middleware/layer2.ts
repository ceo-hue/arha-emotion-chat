/**
 * Layer 2 — 함수언어 엔지니어링 (결정론적)
 * Σ_SymbolMatch → Φ_MorphemeAnchor → β_SubVector → Ω_Bridge → Γ_VectorField → Δ_Equilibrium
 */

import type {
  SemanticUnitArray, ConnectedVectorField,
  MorphemeUnit, SubVectorField, BridgeOperator, Axis,
  InterferenceAnchor, Vector7D,
} from './types';
import {
  SYMBOL_LIBRARY, BRIDGE_OPERATORS, KEYWORD_TO_ANCHOR,
} from './constants';

// ─────────────────────────────────────────
// Σ_SymbolMatch — 시맨틱 코어 → 심볼 매핑
// ─────────────────────────────────────────

function matchSymbol(semantic_core: string, axis: Axis): string {
  const lower = semantic_core.toLowerCase();

  // 축 필터 후 키워드 매칭
  const candidates = SYMBOL_LIBRARY.filter(s => s.axis === axis);
  const matched = candidates.find(s =>
    s.semantics.some(kw => lower.includes(kw))
  );

  if (matched) return matched.symbol;

  // 폴백: 축의 기본 심볼
  const axisSymbols: Record<Axis, string> = {
    emotion: 'Ψ', visual: 'σ', rhythm: 'Φ', state: 'Λ',
    relation: 'Θ', video: 'M', physics: 'G', music: 'Mel',
  };
  return axisSymbols[axis];
}

// ─────────────────────────────────────────
// Φ_MorphemeAnchor — 형식 표기 생성
// ─────────────────────────────────────────

function buildSurfaceForm(
  symbol: string,
  dim_anchor: string,
  I: number, D: number, E: number,
): string {
  return `${symbol}(${dim_anchor}){I:${I.toFixed(2)},D:${D.toFixed(2)},E:${E.toFixed(2)}}`;
}

// ─────────────────────────────────────────
// Ω_Bridge — 연산자 선택
// ─────────────────────────────────────────

function selectOperator(
  prev: MorphemeUnit | null,
  curr: MorphemeUnit,
): BridgeOperator {
  if (!prev) return '⊕'; // 첫 번째는 단순 합

  const same_axis = prev.axis === curr.axis;
  const high_entropy = curr.E > 0.7;
  const temporal = curr.dimension_anchor === 'TM' || prev.dimension_anchor === 'TM';

  if (temporal)    return '∫'; // 시간 축 → 누적
  if (same_axis && curr.I > 0.8) return '⊗'; // 같은 축 고확신 → 텐서 변조
  if (high_entropy) return '√'; // 고엔트로피 → 본질 추출
  if (curr.dimension_anchor === 'RL') return '∇'; // 관계 → 방향성
  if (same_axis)   return 'A/B'; // 같은 축 → 상대 비율
  return '⊕'; // 기본 → 독립 합산
}

// ─────────────────────────────────────────
// β_SubVector — 축별 서브벡터 구성
// ─────────────────────────────────────────

function buildSubVectors(morphemes: MorphemeUnit[]): SubVectorField[] {
  const byAxis: Partial<Record<Axis, MorphemeUnit[]>> = {};
  for (const m of morphemes) {
    if (!byAxis[m.axis]) byAxis[m.axis] = [];
    byAxis[m.axis]!.push(m);
  }

  return Object.entries(byAxis).map(([axis, ms]) => {
    const avg_I = ms.reduce((s, m) => s + m.I, 0) / ms.length;
    const avg_D = ms.reduce((s, m) => s + m.D, 0) / ms.length;
    const avg_E = ms.reduce((s, m) => s + m.E, 0) / ms.length;
    const magnitude = ms.reduce((s, m) => s + m.importance, 0) / ms.length;
    const dominant = ms.reduce((a, b) => a.importance > b.importance ? a : b);

    const density: 'low' | 'medium' | 'high' =
      avg_D > 0.7 ? 'high' : avg_D > 0.4 ? 'medium' : 'low';

    return {
      id: `v_${axis}`,
      axis: axis as Axis,
      morpheme_ids: ms.map(m => m.id),
      dominant_core: dominant.semantic_core,
      magnitude: Math.min(1.0, magnitude),
      tri_summary: { I: avg_I, D: avg_D, E: avg_E },
      render_hint: {
        tone: dominant.semantic_core,
        density,
        priority: magnitude,
      },
    };
  });
}

// ─────────────────────────────────────────
// Γ_VectorField — 수식 표현 문자열 조립
// ─────────────────────────────────────────

function buildExpression(morphemes: MorphemeUnit[]): string {
  if (morphemes.length === 0) return '';
  if (morphemes.length === 1) return morphemes[0].surface_form;

  const parts: string[] = [];
  let prev: MorphemeUnit | null = null;

  for (const m of morphemes) {
    if (prev) {
      const op = selectOperator(prev, m);
      parts.push(op);
    }
    parts.push(m.surface_form);
    prev = m;
  }

  return parts.join(' ');
}

// ─────────────────────────────────────────
// Δ_Equilibrium — 평형 점수
// ─────────────────────────────────────────

function computeEquilibrium(morphemes: MorphemeUnit[], sub_vectors: SubVectorField[]): number {
  if (morphemes.length === 0) return 0;

  // 축 분산 (다양하면 높음)
  const unique_axes = new Set(morphemes.map(m => m.axis)).size;
  const axis_diversity = Math.min(1.0, unique_axes / 4);

  // I/D/E 균형 (너무 한쪽으로 치우치지 않으면 높음)
  const avg_I = morphemes.reduce((s, m) => s + m.I, 0) / morphemes.length;
  const avg_E = morphemes.reduce((s, m) => s + m.E, 0) / morphemes.length;
  const balance = 1.0 - Math.abs(avg_I - 0.6) - Math.abs(avg_E - 0.3);

  // 서브벡터 magnitude 분산이 낮으면 안정
  const magnitudes = sub_vectors.map(v => v.magnitude);
  const avg_mag = magnitudes.reduce((s, v) => s + v, 0) / (magnitudes.length || 1);
  const variance = magnitudes.reduce((s, v) => s + (v - avg_mag) ** 2, 0) / (magnitudes.length || 1);
  const stability = Math.max(0, 1.0 - variance * 2);

  return Math.min(1.0, Math.max(0.0, (axis_diversity * 0.3 + balance * 0.4 + stability * 0.3)));
}

// ─────────────────────────────────────────
// Ξ_InterferenceDetect — 교집합 국소 앵커 생성
// ─────────────────────────────────────────

/** 두 서브벡터의 I/D/E 코사인 유사도 계산 */
function cosineSimilarity(
  a: { I: number; D: number; E: number },
  b: { I: number; D: number; E: number },
): number {
  const dot   = a.I * b.I + a.D * b.D + a.E * b.E;
  const normA = Math.sqrt(a.I ** 2 + a.D ** 2 + a.E ** 2);
  const normB = Math.sqrt(b.I ** 2 + b.D ** 2 + b.E ** 2);
  if (normA === 0 || normB === 0) return 0;
  return dot / (normA * normB);
}

/** 두 7D 벡터의 교집합 중점 계산 */
function midpoint7D(a: SubVectorField, b: SubVectorField): Vector7D {
  const ta = a.tri_summary;
  const tb = b.tri_summary;
  const wa = a.magnitude;
  const wb = b.magnitude;
  const wt = wa + wb || 1;
  // magnitude 가중 평균
  return {
    I: (ta.I * wa + tb.I * wb) / wt,
    D: (ta.D * wa + tb.D * wb) / wt,
    E: (ta.E * wa + tb.E * wb) / wt,
    T: 0.50,   // 시간성: 중립
    S: Math.min(wa, wb) / Math.max(wa, wb, 0.01), // 유사도 반영
    C: (ta.I * wa + tb.I * wb) / wt * 0.85,
    R: Math.abs(ta.I - tb.I) * 0.5,  // 두 축의 I 차이 → 상대성
  };
}

/** 교집합 브릿지 연산자 결정 */
function selectInterferenceOperator(
  axis_a: Axis,
  axis_b: Axis,
  cosine: number,
  vec_a: SubVectorField,
  vec_b: SubVectorField,
): InterferenceAnchor['forced_operator'] {
  const has_temporal = axis_a === 'state' || axis_b === 'state'
    || axis_a === 'rhythm' || axis_b === 'rhythm';
  const has_relation = axis_a === 'relation' || axis_b === 'relation';

  if (has_temporal) return '∫';         // 시간 축 포함 → 누적 연산
  if (has_relation) return '∇';         // 관계 축 포함 → 방향 흐름
  if (cosine > 0.85) return '⊗';        // 매우 유사 → 비선형 간섭
  if (cosine > 0.65) return '⊗';        // 중간 유사 → 비선형 간섭
  return '⊕';                           // 낮은 유사도 → 독립 공존
}

const INTERFERENCE_THRESHOLD = 0.60; // 이 이상 유사도면 교집합 앵커 생성
const INTERFERENCE_FACTOR    = 1.35; // 중력 증폭 계수

function detectInterferenceAnchors(sub_vectors: SubVectorField[]): InterferenceAnchor[] {
  const anchors: InterferenceAnchor[] = [];
  const pairs_seen = new Set<string>();

  for (let i = 0; i < sub_vectors.length; i++) {
    for (let j = i + 1; j < sub_vectors.length; j++) {
      const va = sub_vectors[i];
      const vb = sub_vectors[j];

      // 중복 쌍 스킵
      const pair_key = [va.axis, vb.axis].sort().join('|');
      if (pairs_seen.has(pair_key)) continue;
      pairs_seen.add(pair_key);

      const cosine = cosineSimilarity(va.tri_summary, vb.tri_summary);
      if (cosine < INTERFERENCE_THRESHOLD) continue;

      const base_gravity = (0.6 + va.magnitude * 0.3 + 0.6 + vb.magnitude * 0.3) / 2;
      const interference_gravity = Math.min(1.0, base_gravity * INTERFERENCE_FACTOR);
      const forced_operator = selectInterferenceOperator(va.axis, vb.axis, cosine, va, vb);
      const position = midpoint7D(va, vb);

      const AXIS_NARRATIVE: Partial<Record<Axis, string>> = {
        emotion: '감성',
        visual:  '시각',
        rhythm:  '리듬',
        state:   '상태',
        relation: '관계',
        video:   '영상',
        physics: '물리',
        music:   '음악',
      };
      const name_a = AXIS_NARRATIVE[va.axis] || va.axis;
      const name_b = AXIS_NARRATIVE[vb.axis] || vb.axis;

      anchors.push({
        id:                  `ia_${va.axis}_${vb.axis}`,
        axis_a:              va.axis,
        axis_b:              vb.axis,
        position,
        cosine_similarity:   cosine,
        interference_gravity,
        forced_operator,
        narrative:           `${name_a}과 ${name_b}이 ${(cosine * 100).toFixed(0)}% 교집합 — 국소 앵커 형성`,
      });
    }
  }

  // 중력 내림차순 정렬
  return anchors.sort((a, b) => b.interference_gravity - a.interference_gravity);
}

// ─────────────────────────────────────────
// 공개 API
// ─────────────────────────────────────────

export function runLayer2(semantic_array: SemanticUnitArray): ConnectedVectorField {
  const { semantic_units } = semantic_array;

  // 형태소 구성
  const morphemes: MorphemeUnit[] = semantic_units.map((unit, idx) => {
    const symbol = matchSymbol(unit.semantic_core, unit.axis);
    const surface_form = buildSurfaceForm(
      symbol, unit.dimension_anchor, unit.I, unit.D, unit.E
    );
    const importance = (unit.I + unit.D) / 2 * unit.confidence;

    return {
      id:               `m_${idx}`,
      surface_form,
      base_function:    symbol,
      semantic_core:    unit.semantic_core,
      axis:             unit.axis,
      dimension_anchor: unit.dimension_anchor,
      I:                unit.I,
      D:                unit.D,
      E:                unit.E,
      importance,
    };
  });

  // 중요도 내림차순 정렬
  morphemes.sort((a, b) => b.importance - a.importance);

  // 서브벡터 구성
  const sub_vector_field = buildSubVectors(morphemes);

  // 우세 벡터
  const dominant_vector = sub_vector_field.reduce((a, b) =>
    a.magnitude > b.magnitude ? a : b,
    sub_vector_field[0] || {
      id: 'v_emotion', axis: 'emotion' as Axis,
      morpheme_ids: [], dominant_core: '',
      magnitude: 0, tri_summary: { I: 0.5, D: 0.5, E: 0.3 },
      render_hint: { tone: '', density: 'medium' as const, priority: 0 },
    }
  );

  // 수식 표현 조립
  const expression = buildExpression(morphemes);

  // 평형 점수
  const equilibrium_state = computeEquilibrium(morphemes, sub_vector_field);

  // 교집합 국소 앵커 탐지
  const interference_anchors = detectInterferenceAnchors(sub_vector_field);

  return {
    morphemes,
    expression,
    sub_vector_field,
    dominant_vector,
    equilibrium_state,
    interference_anchors,
  };
}
