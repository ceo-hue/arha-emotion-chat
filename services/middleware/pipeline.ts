/**
 * ARHA 함수언어 미들웨어 — 전체 파이프라인 오케스트레이션
 *
 * Layer 0 (결정론적) → API(Layer 1+3) → Layer 2 (결정론적) → Layer 4 (결정론적)
 *
 * Layer 1, 3은 서버 엔드포인트(/api/middleware)를 통해 Claude가 처리.
 * 클라이언트에서 실행 시: Layer 0 → fetch('/api/middleware') → Layer 4
 */

import type {
  MiddlewareConfig, MiddlewarePipelineResult,
  InputObject, SemanticUnitArray, ConnectedVectorField,
  VerifiedEquationPackage, LLMAPIInput,
} from './types';
import { runLayer0 } from './layer0';
import { runLayer2 } from './layer2';
import { runLayer4, compileModalityPrompts } from './layer4';
import { MEMORY_CONFIG } from './constants';

// ─────────────────────────────────────────
// 역방향 번역 — 수식 → 자연어 요약
// ─────────────────────────────────────────

import type { ReverseTranslation } from './types';
import { BRIDGE_OPERATORS } from './constants';

function buildReverseTranslation(
  eq_pkg: VerifiedEquationPackage,
  vector_field: ConnectedVectorField,
): ReverseTranslation {
  // 수식 → 자연어 요약
  let eq_summary = eq_pkg.Eq_final;
  for (const op of BRIDGE_OPERATORS) {
    eq_summary = eq_summary.replaceAll(op.symbol, ` ${op.ko_word} `);
  }
  const equation_to_summary = `${eq_summary.trim()}. ${eq_pkg.meta_block.narrative_summary}`;

  // 형태소 → 인간 언어
  const morpheme_to_human = vector_field.morphemes.slice(0, 4).map(m =>
    `${m.semantic_core}: 확신 ${(m.I * 100).toFixed(0)}%, 밀도 ${(m.D * 100).toFixed(0)}%`
  );

  return { equation_to_summary, morpheme_to_human };
}

// ─────────────────────────────────────────
// 서버 API 호출 (Layer 1 + Layer 3)
// ─────────────────────────────────────────

interface ServerMiddlewareResponse {
  semantic_array: SemanticUnitArray;
  equation_package: VerifiedEquationPackage;
}

async function callServerMiddleware(
  input: InputObject,
  vector_field: ConnectedVectorField,
): Promise<ServerMiddlewareResponse> {
  const res = await fetch('/api/middleware', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ input, vector_field }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Middleware API error ${res.status}: ${err}`);
  }
  return res.json() as Promise<ServerMiddlewareResponse>;
}

// ─────────────────────────────────────────
// 메인 파이프라인 실행
// ─────────────────────────────────────────

export async function executePipeline(
  raw_text: string,
  config: MiddlewareConfig,
): Promise<MiddlewarePipelineResult> {
  const { analysis_data, harness_state, target_modalities } = config;

  // ── Layer 0: 입력 정규화 (클라이언트) ──
  const input: InputObject = runLayer0(raw_text, {
    analysis:          analysis_data,
    harness_state:     harness_state
      ? { session_id: harness_state.session_id, turn_count: harness_state.turn_count }
      : undefined,
    context_anchor:    harness_state ? { session_id: harness_state.session_id } : undefined,
    target_modalities: target_modalities,
  });

  // ── Layer 2 (1단계): Layer 1 없이 간이 SemanticUnitArray 생성 ──
  // 실제 Layer 1(Claude)은 서버에서 처리. 먼저 Layer 2용 기본 배열 생성.
  const preliminary_vector_field: ConnectedVectorField = runLayer2({
    subject_context: [],
    semantic_units: input.sentence_units.map((s, i) => ({
      raw_text: s,
      semantic_core: s.split(' ')[0] || s,
      axis: 'emotion' as const,
      dimension_anchor: 'ST' as const,
      I: 0.70,
      D: 0.60,
      E: 0.35,
      confidence: 0.75,
    })),
    axis_activation_map: input.axis_weights,
    vector_7D_final: {
      I: 0.70, D: 0.65, E: 0.35,
      T: 0.50, S: 0.50, C: 0.70, R: 0.50,
    },
    mu_memory: harness_state?.psi_resonance ?? 0,
    constraint_log: [],
    cross_effect_log: [],
  });

  // ── Server API: Layer 1 + Layer 3 (Claude) ──
  let semantic_array: SemanticUnitArray;
  let equation_package: VerifiedEquationPackage;

  try {
    const server_result = await callServerMiddleware(input, preliminary_vector_field);
    semantic_array   = server_result.semantic_array;
    equation_package = server_result.equation_package;
  } catch (e) {
    console.warn('[Middleware] Server call failed, using fallback:', e);
    // 폴백: 간이 수식 생성
    semantic_array = {
      subject_context: input.sentence_units.slice(0, 2),
      semantic_units: preliminary_vector_field.morphemes.map(m => ({
        raw_text: m.semantic_core,
        semantic_core: m.semantic_core,
        axis: m.axis,
        dimension_anchor: m.dimension_anchor,
        I: m.I, D: m.D, E: m.E,
        confidence: 0.70,
      })),
      axis_activation_map: input.axis_weights,
      vector_7D_final: { I: 0.70, D: 0.65, E: 0.35, T: 0.50, S: 0.50, C: 0.70, R: 0.50 },
      mu_memory: 0,
      constraint_log: ['FALLBACK MODE'],
      cross_effect_log: [],
    };
    equation_package = {
      Eq_final: `Ψ(ST) ⊕ Λ(TM)`,
      Eq_components: [],
      blended_vector: semantic_array.vector_7D_final,
      discipline: 'calculus',
      applied_gv: 'GV_ARHA_Conversation',
      blend_log: ['FALLBACK'],
      meta_block: {
        narrative_summary: input.sentence_units[0] || '감성적 표현',
        confidence_score: 0.50,
        discipline_confidence: 0.50,
      },
      audit_result: {
        dimensional_consistency: true,
        operator_validity: true,
        constraint_satisfied: true,
        issues: [],
      },
    };
  }

  // ── Layer 2: 정식 벡터 필드 구성 (서버 결과 기반) ──
  const vector_field = runLayer2(semantic_array);

  // ── Layer 4: 기술 프롬프트 컴파일 (클라이언트) ──
  const llm_input: LLMAPIInput = runLayer4(equation_package, vector_field, input);

  // ── 역방향 번역 ──
  const reverse_translation = buildReverseTranslation(equation_package, vector_field);

  // ── 하네스 상태 업데이트 ──
  const updated_state = harness_state
    ? {
        ...harness_state,
        turn_count: (harness_state.turn_count || 0) + 1,
        anchor_L0: llm_input.metadata.centroid,
      }
    : undefined;

  return {
    modality_prompts:    llm_input.metadata.modality_prompts,
    equation:            equation_package.Eq_final,
    narrative:           equation_package.meta_block.narrative_summary,
    temperature:         llm_input.temperature,
    top_p:               llm_input.top_p,
    anchor_hierarchy:    llm_input.metadata.anchor_config,
    blended_vector:      llm_input.metadata.blended_vector,
    reverse_translation,
    updated_state,
    debug: config.enable_quality_gate ? {
      input_object:     input,
      semantic_units:   semantic_array,
      vector_field,
      equation_package,
    } : undefined,
  };
}
