/**
 * Layer 2 — 함수언어 엔지니어링 (결정론적)
 * Σ_SymbolMatch → Φ_MorphemeAnchor → β_SubVector → Ω_Bridge → Γ_VectorField → Δ_Equilibrium
 */

import type {
  SemanticUnitArray, ConnectedVectorField,
  MorphemeUnit, SubVectorField, BridgeOperator, Axis,
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

  return {
    morphemes,
    expression,
    sub_vector_field,
    dominant_vector,
    equilibrium_state,
  };
}
