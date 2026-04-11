/**
 * Layer 4 — Equation-to-Prompt Compiler (결정론적)
 * Π_EqParser → Γ_AnchorBuild → Λ_GravityCompute → Τ_LogitBiasGen → Φ_ModalityPrompts
 *
 * 핵심: VerifiedEquationPackage → 6개 모달리티 기술 프롬프트
 */

import type {
  VerifiedEquationPackage, ConnectedVectorField, InputObject,
  AnchorHierarchy, LLMAPIInput, ModalityPrompts, LogitBias,
  Vector7D, Axis,
} from './types';
import {
  TEMPERATURE_BASE, TOP_P_BASE,
  GOLDEN_VECTORS, EXPRESSION_MODE_GV_MAP, MODALITY_GV_PRIORITY,
} from './constants';

// ─────────────────────────────────────────
// Γ_AnchorBuild — L0/L1/L2/L3 앵커 계층 구성
// ─────────────────────────────────────────

function buildAnchorHierarchy(
  eq_pkg: VerifiedEquationPackage,
  vector_field: ConnectedVectorField,
  input: InputObject,
): AnchorHierarchy {
  const bv = eq_pkg.blended_vector;

  // L0: 코어 앵커 (영구, 블렌딩 벡터 기반)
  const L0 = {
    position: bv,
    gravity: 1.0 as const,
    label: 'core' as const,
  };

  // L1: 메인 앵커 (상위 3개 활성 축)
  const top_axes = Object.entries(input.axis_weights)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 3)
    .map(([axis, weight]) => ({
      axis: axis as Axis,
      position: blendPositions(bv, { I: weight, D: weight * 0.8, E: 1 - weight, T: 0.5, S: 0.5, C: weight, R: 0.5 }, 0.3),
      gravity: 0.85 + bv.C * 0.10,
      label: `L1_${axis}`,
    }));

  // L2: 서브 앵커 (형태소 기반)
  const L2 = vector_field.morphemes.slice(0, 5).map(m => ({
    symbol: m.surface_form,
    position: blendPositions(bv, { I: m.I, D: m.D, E: m.E, T: 0.5, S: 0.4, C: m.I * 0.8, R: 0.4 }, 0.4),
    gravity: 0.6 + m.importance * 0.3,
    label: `L2_${m.semantic_core}`,
  }));

  // L3: 서포트 앵커 (서브벡터 기반, 휘발성)
  const L3 = vector_field.sub_vector_field.map(sv => ({
    source: sv.id,
    position: blendPositions(bv, { I: sv.tri_summary.I, D: sv.tri_summary.D, E: sv.tri_summary.E, T: 0.5, S: 0.5, C: 0.6, R: 0.4 }, 0.5),
    gravity: 0.5 as const,
    label: `L3_${sv.dominant_core}`,
  }));

  // L_local: 교집합 국소 앵커 → 앵커 계층에 삽입
  const L_local = (vector_field.interference_anchors ?? []).map(ia => ({
    id:              ia.id,
    position:        ia.position,
    gravity:         ia.interference_gravity,
    forced_operator: ia.forced_operator,
    label:           `L_local_${ia.axis_a}∩${ia.axis_b}(cos=${ia.cosine_similarity.toFixed(2)})`,
  }));

  // 센트로이드: L0 + L1 + L_local 평균 (국소 앵커 포함)
  const centroid_sources = [
    L0.position,
    ...top_axes.map(a => a.position),
    ...L_local.map(l => l.position),
  ];
  const centroid = averageVectors(centroid_sources);

  return { L0, L1: top_axes, L2, L3, L_local, centroid };
}

function blendPositions(base: Vector7D, target: Partial<Vector7D>, target_weight: number): Vector7D {
  const w = target_weight;
  const bw = 1 - w;
  return {
    I: (base.I * bw) + ((target.I ?? base.I) * w),
    D: (base.D * bw) + ((target.D ?? base.D) * w),
    E: (base.E * bw) + ((target.E ?? base.E) * w),
    T: (base.T * bw) + ((target.T ?? base.T) * w),
    S: (base.S * bw) + ((target.S ?? base.S) * w),
    C: (base.C * bw) + ((target.C ?? base.C) * w),
    R: (base.R * bw) + ((target.R ?? base.R) * w),
  };
}

function averageVectors(vecs: Vector7D[]): Vector7D {
  const n = vecs.length || 1;
  return {
    I: vecs.reduce((s, v) => s + v.I, 0) / n,
    D: vecs.reduce((s, v) => s + v.D, 0) / n,
    E: vecs.reduce((s, v) => s + v.E, 0) / n,
    T: vecs.reduce((s, v) => s + v.T, 0) / n,
    S: vecs.reduce((s, v) => s + v.S, 0) / n,
    C: vecs.reduce((s, v) => s + v.C, 0) / n,
    R: vecs.reduce((s, v) => s + v.R, 0) / n,
  };
}

// ─────────────────────────────────────────
// Θ_APIParam — Temperature / Top-P 계산
// ─────────────────────────────────────────

function computeAPIParams(eq_pkg: VerifiedEquationPackage): {
  temperature: number;
  top_p: number;
  frequency_penalty: number;
} {
  const { discipline, blended_vector: bv } = eq_pkg;

  let temp = TEMPERATURE_BASE;
  if (discipline === 'harmonic')       temp -= 0.10;
  if (bv.E > 0.8)                     temp += 0.20;
  if (bv.C > 0.8)                     temp -= 0.10;
  const temperature = Math.min(1.2, Math.max(0.3, temp));

  let tp = TOP_P_BASE;
  if (bv.D > 0.7) tp -= 0.10;
  if (bv.R > 0.7) tp -= 0.15;
  const top_p = Math.min(1.0, Math.max(0.5, tp));

  const frequency_penalty = bv.I * 0.2;

  return { temperature, top_p, frequency_penalty };
}

// ─────────────────────────────────────────
// Τ_LogitBiasGen — 로짓 바이어스 생성
// ─────────────────────────────────────────

function buildLogitBias(
  eq_pkg: VerifiedEquationPackage,
  vector_field: ConnectedVectorField,
): LogitBias {
  const bv = eq_pkg.blended_vector;
  const top_cores = vector_field.morphemes.slice(0, 5).map(m => m.semantic_core);

  // HIGH bias: 감성 핵심 토큰 강화
  const high_bias = top_cores.map((core, i) => ({
    token: core,
    weight: 1.5 + (1 - i * 0.2) * 1.5, // 1.5 ~ 3.0
  }));

  // BLOCK bias: 반의어/불일치 패턴 (고엔트로피면 제한)
  const block_bias: Array<{ token: string; weight: number }> = [];
  if (bv.E < 0.4) {
    block_bias.push({ token: 'chaos', weight: -2.5 });
    block_bias.push({ token: '혼란', weight: -2.5 });
  }
  if (bv.I > 0.8) {
    block_bias.push({ token: 'maybe', weight: -2.0 });
    block_bias.push({ token: '아마', weight: -2.0 });
  }

  // NEUTRAL bias: 다양성 주입
  const neutral_bias = [
    { token: 'however', weight: 0.2 },
    { token: '그러나', weight: 0.2 },
  ];

  return { high_bias, block_bias, neutral_bias };
}

// ─────────────────────────────────────────
// 핵심: 모달리티별 기술 프롬프트 컴파일
// ─────────────────────────────────────────

interface VisualSpec {
  camera_movement: string;
  lighting: string;
  color_palette: string;
  framing: string;
  mood: string;
}

function buildVisualSpec(
  eq_pkg: VerifiedEquationPackage,
  vector_field: ConnectedVectorField,
  context_expression_mode?: string,
): VisualSpec {
  const bv = eq_pkg.blended_vector;
  const dom = vector_field.dominant_vector;

  // camera_movement: T(시간성) + E(엔트로피) 기반
  let camera_movement =
    bv.T > 0.65 ? 'slow dolly-in'
    : bv.E > 0.6 ? 'handheld kinetic'
    : bv.C > 0.8 ? 'static locked-off'
    : 'gentle drift';

  // ARHA expressionMode 오버라이드
  if (context_expression_mode) {
    const overrides: Record<string, string> = {
      DEEP_EMPATHY:    'slow push-in, rack focus',
      REFLECTIVE_GROW: 'slow pull-back reveal',
      INTENSE_JOY:     'handheld kinetic energy',
      ANALYTIC_THINK:  'static locked-off frame',
      SERENE_SMILE:    'gentle imperceptible drift',
      PLAYFUL_TEASE:   'tilted dutch angle, playful reframe',
      SOFT_WARMTH:     'slow dolly-in',
    };
    if (overrides[context_expression_mode]) {
      camera_movement = overrides[context_expression_mode];
    }
  }

  // lighting: I(확신) + visual axis
  const lighting =
    bv.I > 0.8 ? 'sharp clinical clarity, even lighting'
    : bv.E > 0.6 ? 'dramatic chiaroscuro, contrast'
    : dom.axis === 'emotion' ? 'warm backlight, golden hour'
    : 'soft diffused natural light';

  // color_palette: E + T 기반
  const color_palette =
    bv.E > 0.7 ? 'high contrast saturated'
    : bv.T > 0.6 ? 'desaturated cool muted tones'
    : bv.I > 0.8 ? 'clean neutral palette'
    : 'Kodak Portra warmth, pastel';

  // framing: D(밀도) 기반
  const framing =
    bv.D > 0.7 ? 'tight close-up, emotional presence'
    : bv.D < 0.4 ? 'wide open negative space'
    : 'intimate medium framing';

  // mood: narrative summary에서 추출
  const mood = eq_pkg.meta_block.narrative_summary || dom.dominant_core;

  return { camera_movement, lighting, color_palette, framing, mood };
}

function buildMusicSpec(
  eq_pkg: VerifiedEquationPackage,
  vector_field: ConnectedVectorField,
): { bpm: string; key: string; instruments: string; texture: string; structure: string } {
  const bv = eq_pkg.blended_vector;

  // BPM: T(시간성) + E(엔트로피)
  const bpm_val = Math.round(60 + bv.T * 40 + bv.E * 30);
  const bpm = `${bpm_val} BPM`;

  // 조성: I(확신)이 높으면 장조, 낮으면 단조
  const key = bv.I > 0.7 ? 'major key' : bv.E > 0.6 ? 'minor pentatonic' : 'minor key';

  // 악기: 지배 축 기반
  const dom_axis = vector_field.dominant_vector.axis;
  const instruments: Record<string, string> = {
    emotion:  'sparse piano, cello',
    visual:   'strings, ambient pad',
    rhythm:   'acoustic guitar, percussion',
    state:    'piano, sustained strings',
    relation: 'piano, violin duo',
    video:    'cinematic strings, brass',
    physics:  'percussion, deep bass',
    music:    'full orchestration',
  };
  const instrument = instruments[dom_axis] || 'piano';

  // 텍스처: E + D 기반
  const texture =
    bv.E > 0.7 ? 'layered complex texture, reverb'
    : bv.D > 0.7 ? 'dense harmonic texture'
    : 'sparse minimal texture, long reverb tail';

  // 구조
  const structure = bv.T > 0.6 ? 'slow build, gradual development' : 'consistent, meditative';

  return { bpm, key, instruments: instrument, texture, structure };
}

export function compileModalityPrompts(
  eq_pkg: VerifiedEquationPackage,
  vector_field: ConnectedVectorField,
  input: InputObject,
): ModalityPrompts {
  const bv = eq_pkg.blended_vector;
  const narrative = eq_pkg.meta_block.narrative_summary;
  const expression_mode = input.context_anchor?.expression_mode;

  // ── 골든벡터 선택 (expressionMode 우선, 그 다음 applied_gv) ──
  const em_gv_id = expression_mode
    ? EXPRESSION_MODE_GV_MAP[expression_mode]
    : undefined;
  const gv_id = em_gv_id
    ?? (eq_pkg.applied_gv as keyof typeof GOLDEN_VECTORS)
    ?? 'GV_System_Default';
  const gv = GOLDEN_VECTORS[gv_id] ?? GOLDEN_VECTORS['GV_System_Default'];
  const gv_style = gv.personality_vectors.join(', ');

  // ── 교집합 국소 앵커 — 프롬프트 정밀도 강화 키워드 ──
  const interference_anchors = vector_field.interference_anchors ?? [];
  const interference_hints = interference_anchors
    .slice(0, 2) // 상위 2개만 사용
    .map(ia => ia.narrative)
    .join('; ');

  // 시각 스펙
  const vs = buildVisualSpec(eq_pkg, vector_field, expression_mode);

  // 음악 스펙
  const ms = buildMusicSpec(eq_pkg, vector_field);

  // 핵심 의미 키워드
  const cores = vector_field.morphemes
    .slice(0, 3)
    .map(m => m.semantic_core)
    .join(', ');

  // 교집합이 있으면 forced_operator를 수식 힌트로 활용
  const top_ia = interference_anchors[0];
  const ia_operator_hint = top_ia ? `interference:${top_ia.forced_operator}` : '';

  // ── 영상 프롬프트 ──
  const video = [
    vs.camera_movement,
    vs.lighting,
    vs.color_palette,
    vs.framing,
    `atmospheric mood: ${vs.mood}`,
    gv_style,
    ia_operator_hint,
    'cinematic grain, professional color grade',
  ].filter(Boolean).join(', ');

  // ── 이미지 프롬프트 ──
  const image = [
    cores,
    vs.lighting,
    vs.color_palette,
    vs.framing,
    `mood: ${vs.mood}`,
    gv_style,
    interference_hints || undefined,
    bv.I > 0.8 ? 'sharp detail, clinical precision' : 'film grain, bokeh',
    'professional photography',
  ].filter(Boolean).join(', ');

  // ── 음악 프롬프트 ──
  const music = [
    ms.instruments,
    ms.key,
    ms.bpm,
    ms.texture,
    ms.structure,
    gv_style,
    interference_hints || undefined,
    `emotional core: ${cores}`,
  ].filter(Boolean).join(', ');

  // ── 코드 프롬프트 (주석 톤 지시) ──
  const code_tone =
    bv.I > 0.85 ? '// 정밀하고 최소화된 구조. 명시적 타입, 주석 최소화.'
    : bv.E > 0.6  ? '// 탐색적 구조 — 실험적이고 유연하게.'
    : bv.D > 0.7  ? '// 밀도 높은 로직. 성능 우선.'
    : `// ${narrative} — 코드로 표현할 때의 구조적 의도`;

  const code = [
    code_tone,
    `// 핵심 의미: ${cores}`,
    `// 수식: ${eq_pkg.Eq_final}`,
    `// 규율: ${eq_pkg.discipline}`,
  ].join('\n');

  // ── 디자인 파라미터 ──
  const design_palette =
    bv.I > 0.8 ? '#f8f9fa, #212529, #0d6efd' // 클린 모노
    : bv.E > 0.6 ? '#1a1a2e, #e94560, #f5a623' // 드라마틱
    : bv.T > 0.6 ? '#1a2233, #2d3a4a, #c8d4e0' // 쿨 무드
    : '#fdf6e3, #7c6f64, #859900'; // 따뜻한 톤

  const design = JSON.stringify({
    color_palette: design_palette,
    layout: bv.D > 0.7 ? 'dense_grid' : 'minimal_breathing_space',
    typography: bv.I > 0.8 ? 'medium_weight_sans' : bv.E > 0.6 ? 'bold_expressive' : 'thin_weight_serif',
    mood: vs.mood,
    spacing: bv.D > 0.7 ? 'compact' : 'generous',
  });

  // ── 기획 프롬프트 ──
  const plan_tone =
    bv.I > 0.85 ? 'analytical, data-driven, concise'
    : bv.E > 0.6  ? 'exploratory, open-ended, iterative'
    : bv.T > 0.6  ? 'reflective, narrative, gradual'
    : 'balanced, structured, empathetic';

  const plan = [
    `tone: ${plan_tone}`,
    `structure: ${ms.structure}`,
    `core_theme: ${narrative}`,
    `depth: ${bv.D > 0.7 ? 'deep_analysis' : 'overview'}`,
    `equation_basis: ${eq_pkg.Eq_final}`,
  ].join('\n');

  return { video, image, music, code, design, plan };
}

// ─────────────────────────────────────────
// 공개 API
// ─────────────────────────────────────────

export function runLayer4(
  eq_pkg: VerifiedEquationPackage,
  vector_field: ConnectedVectorField,
  input: InputObject,
): LLMAPIInput {
  const anchor_config = buildAnchorHierarchy(eq_pkg, vector_field, input);
  const { temperature, top_p, frequency_penalty } = computeAPIParams(eq_pkg);
  const logit_bias = buildLogitBias(eq_pkg, vector_field);
  const modality_prompts = compileModalityPrompts(eq_pkg, vector_field, input);

  const system = [
    `# ARHA 함수언어 미들웨어 — 실행 지시`,
    `## 수식: ${eq_pkg.Eq_final}`,
    `## 서사: ${eq_pkg.meta_block.narrative_summary}`,
    `## 규율: ${eq_pkg.discipline}`,
    `## 7D 벡터: I=${eq_pkg.blended_vector.I.toFixed(2)} D=${eq_pkg.blended_vector.D.toFixed(2)} E=${eq_pkg.blended_vector.E.toFixed(2)}`,
    `위 수식과 서사적 맥락에 기반하여 응답하세요.`,
  ].join('\n');

  return {
    model: 'claude-sonnet-4-20250514',
    system,
    messages: [],
    temperature,
    top_p,
    frequency_penalty,
    logit_bias,
    metadata: {
      anchor_config,
      centroid: anchor_config.centroid,
      blended_vector: eq_pkg.blended_vector,
      modality_prompts,
      discipline: eq_pkg.discipline,
      narrative: eq_pkg.meta_block.narrative_summary,
    },
  };
}
