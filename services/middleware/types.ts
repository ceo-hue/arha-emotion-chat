/**
 * ARHA 함수언어 미들웨어 — 전체 타입 정의
 * Layer 0-6 파이프라인의 모든 인터페이스
 */

// ─────────────────────────────────────────
// 기본 열거형
// ─────────────────────────────────────────

export type Axis = 'emotion' | 'visual' | 'rhythm' | 'state' | 'relation' | 'video' | 'physics' | 'music';

export type DimensionAnchor = 'ST' | 'TM' | 'RL' | 'SP' | 'NV' | 'EX';

export type AnchorMode = 'triangle' | 'square' | 'pentagon' | 'equation';

export type MathDiscipline =
  | 'calculus'
  | 'linear_algebra'
  | 'fluid_dynamics'
  | 'entropy_theory'
  | 'harmonic';

export type BridgeOperator = '√' | 'd/dt' | 'A/B' | '⊗' | '⊕' | '∫' | '∇';

export type GVId =
  | 'GV_ARHA_Conversation'
  | 'GV_Cinematic_Noir_v2'
  | 'GV_Cinematic_Noir_v1'
  | 'GV_Code_Generation'
  | 'GV_Design_Spring'
  | 'GV_Research'
  | 'GV_Technical_Design'
  | 'GV_System_Default';

export type ContentModality = 'video' | 'image' | 'music' | 'code' | 'design' | 'plan';

export type QualityGateDecision = 'PASS' | 'RESAMPLE' | 'FIDELITY_REPAIR' | 'FALLBACK' | 'DIVERSITY_INJECT';

export type CorrectionMode = 'soft' | 'balanced' | 'strict' | 'none';

// ─────────────────────────────────────────
// 7D 벡터
// ─────────────────────────────────────────

/** 7D 의미 벡터 — 모든 레이어에서 공유 */
export interface Vector7D {
  I: number; // Information / Certainty  0-1
  D: number; // semantic Density         0-1
  E: number; // Entropy / Uncertainty    0-1
  T: number; // Temporality              0-1
  S: number; // Sociality                0-1
  C: number; // Coherence                0-1
  R: number; // Relativity               0-1
}

/** 8축 가중치 맵 */
export interface AxisWeights {
  emotion:  number;
  visual:   number;
  rhythm:   number;
  state:    number;
  relation: number;
  video:    number;
  physics:  number;
  music:    number;
}

// ─────────────────────────────────────────
// Layer 0: InputObject
// ─────────────────────────────────────────

export interface InputObject {
  /** 정규화된 텍스트 */
  normalized_text: string;
  /** 원문 */
  raw_text: string;
  /** 언어 코드 */
  lang_flag: 'ko' | 'en' | 'mixed';
  /** 추출된 이모지 */
  emoji_signals: string[];
  /** 문장 단위 분절 */
  sentence_units: string[];
  /** 도메인 분류 */
  domain: string[];
  /** 8축 초기 가중치 */
  axis_weights: AxisWeights;
  /** 복잡도 점수 (0-1) */
  C_score: number;
  /** 앵커 모드 결정 */
  anchor_mode: AnchorMode;
  /** 컨텍스트 영향도 (intra/inter session) */
  xi_weight: number;
  /** 이전 세션 컨텍스트 앵커 */
  context_anchor?: ContextAnchor;
  /** 모호성 태그 */
  ambig_tags: AmbiguityTag[];
  /** 목표 모달리티 */
  target_modalities: ContentModality[];
}

export interface ContextAnchor {
  session_id?: string;
  from_analysis_data?: boolean;
  /** ARHA 감성 상태에서 직접 주입 */
  emotion_vector?: { x: number; y: number; z: number };
  expression_mode?: string;
  trajectory?: string;
  resonance?: number;
  trust_level?: number;
}

export interface AmbiguityTag {
  type: 'Ψ_vs_G' | 'T_vs_S' | 'I_and_D' | 'Ψ_vs_σ' | 'general';
  text: string;
  resolution: string;
}

// ─────────────────────────────────────────
// Layer 1: SemanticUnitArray
// ─────────────────────────────────────────

export interface SemanticUnit {
  /** 원문 표현 */
  raw_text: string;
  /** 정규화된 의미 핵심 (영문) */
  semantic_core: string;
  /** 소속 축 */
  axis: Axis;
  /** 차원 앵커 */
  dimension_anchor: DimensionAnchor;
  /** 7D 초기값 */
  I: number;
  D: number;
  E: number;
  /** 신뢰도 */
  confidence: number;
}

export interface SemanticUnitArray {
  subject_context: string[];
  semantic_units: SemanticUnit[];
  axis_activation_map: Partial<AxisWeights>;
  /** 최종 7D 벡터 */
  vector_7D_final: Vector7D;
  /** 기억 누적값 (지수 감쇠) */
  mu_memory: number;
  /** 적용된 제약 로그 (C1-C6) */
  constraint_log: string[];
  /** 교차축 효과 로그 */
  cross_effect_log: string[];
}

// ─────────────────────────────────────────
// Layer 2: ConnectedVectorField
// ─────────────────────────────────────────

export interface MorphemeUnit {
  id: string; // m_0, m_1, ...
  /** 형식 표기: "Ψ_loneliness(TM){I:0.82,D:0.70,E:0.35}" */
  surface_form: string;
  /** 기본 그리스 문자 함수 */
  base_function: string;
  semantic_core: string;
  axis: Axis;
  dimension_anchor: DimensionAnchor;
  I: number;
  D: number;
  E: number;
  /** 브릿지 연산자 힌트 */
  operator_hint?: BridgeOperator;
  importance: number;
}

export interface SubVectorField {
  id: string; // v_emotion, v_visual, ...
  axis: Axis;
  morpheme_ids: string[];
  dominant_core: string;
  magnitude: number;
  tri_summary: { I: number; D: number; E: number };
  render_hint: { tone: string; density: 'low' | 'medium' | 'high'; priority: number };
}

export interface ConnectedVectorField {
  morphemes: MorphemeUnit[];
  /** 수식 표현 문자열 */
  expression: string;
  sub_vector_field: SubVectorField[];
  dominant_vector: SubVectorField;
  /** 평형 점수 0-1 (높을수록 안정) */
  equilibrium_state: number;
}

// ─────────────────────────────────────────
// Layer 3: VerifiedEquationPackage
// ─────────────────────────────────────────

export interface EquationBlock {
  block: 'A' | 'B' | 'C' | 'D';
  description: string;
  content: string;
}

export interface VerifiedEquationPackage {
  /** 최종 수식 */
  Eq_final: string;
  /** 블록별 구성 요소 */
  Eq_components: EquationBlock[];
  /** 골든벡터 블렌딩 결과 */
  blended_vector: Vector7D;
  /** 선택된 수학 규율 */
  discipline: MathDiscipline;
  /** 적용된 GV */
  applied_gv: GVId;
  /** 블렌딩 로그 */
  blend_log: string[];
  meta_block: {
    narrative_summary: string;
    confidence_score: number;
    discipline_confidence: number;
  };
  audit_result: {
    dimensional_consistency: boolean;
    operator_validity: boolean;
    constraint_satisfied: boolean;
    issues: string[];
  };
}

// ─────────────────────────────────────────
// Layer 4: LLM API Input + Modality Prompts
// ─────────────────────────────────────────

export interface AnchorHierarchy {
  L0: { position: Vector7D; gravity: 1.0; label: 'core' };
  L1: Array<{ axis: Axis; position: Vector7D; gravity: number; label: string }>;
  L2: Array<{ symbol: string; position: Vector7D; gravity: number; label: string }>;
  L3: Array<{ source: string; position: Vector7D; gravity: 0.5; label: string }>;
  centroid: Vector7D;
}

export interface LogitBias {
  high_bias:    Array<{ token: string; weight: number }>;
  block_bias:   Array<{ token: string; weight: number }>;
  neutral_bias: Array<{ token: string; weight: number }>;
}

/** 모달리티별 기술 프롬프트 — Layer 4의 핵심 출력 */
export interface ModalityPrompts {
  video:  string;
  image:  string;
  music:  string;
  code:   string;
  design: string;
  plan:   string;
}

export interface LLMAPIInput {
  model: string;
  system: string;
  messages: Array<{ role: 'user' | 'assistant'; content: string }>;
  temperature: number;
  top_p: number;
  frequency_penalty?: number;
  logit_bias: LogitBias;
  metadata: {
    anchor_config: AnchorHierarchy;
    centroid: Vector7D;
    blended_vector: Vector7D;
    modality_prompts: ModalityPrompts;
    discipline: MathDiscipline;
    narrative: string;
  };
}

// ─────────────────────────────────────────
// Layer 5: ValidatedResponse
// ─────────────────────────────────────────

export interface QualityReport {
  anchor_fit_score:       number; // 0-1, weight 0.35
  axis_coverage_score:    number; // 0-1, weight 0.25
  high_bias_adherence:    number; // 0-1, weight 0.20
  vector_alignment:       number; // 0-1, weight 0.20
  total_score:            number; // 가중 합계
  fidelity_score:         number; // 의미 보존 (코사인 유사도)
  gate_decision:          QualityGateDecision;
  attempt_count:          number;
}

export interface ReverseTranslation {
  equation_to_summary: string;
  morpheme_to_human:   string[];
}

export interface ValidatedResponse {
  response_text:       string;
  quality_report:      QualityReport;
  reverse_translation: ReverseTranslation;
  execution_meta: {
    model_used:        string;
    tokens_used:       number;
    latency_ms:        number;
  };
}

// ─────────────────────────────────────────
// Layer 6: HarnessState (Firestore 지속성)
// ─────────────────────────────────────────

export type MemoryTier = 1 | 2 | 3; // 1=Immediate, 2=Recent, 3=Core

export interface MemoryEntry {
  tier:              MemoryTier;
  content:           unknown;
  priority:          'critical' | 'high' | 'normal' | 'skip';
  timestamp:         number;
  quality_score?:    number;
  transition_flag?:  boolean;
}

export interface HarnessState {
  session_id:        string;
  turn_count:        number;
  psi_resonance:     number; // Ψ_Resonance 누적
  memory_tiers:      MemoryEntry[];
  gv_performance:    Record<GVId, { avg_score: number; sample_count: number; expert_weight: number }>;
  translation_cache: Record<string, { prompts: ModalityPrompts; quality_score: number; expires_at: number }>;
  eureka_detected:   boolean;
  anchor_L0:         Vector7D;
}

// ─────────────────────────────────────────
// 전체 파이프라인 입출력
// ─────────────────────────────────────────

/** 파이프라인 실행 설정 */
export interface MiddlewareConfig {
  target_modalities: ContentModality[];
  /** ARHA 감성 분석 결과 (선택 — 있으면 앵커로 주입) */
  analysis_data?: ARHAAnalysisInput;
  /** 세션 상태 (있으면 mu_memory + xi_weight 계산에 사용) */
  harness_state?: HarnessState;
  /** 품질 게이트 활성화 여부 */
  enable_quality_gate?: boolean;
  /** 최대 재샘플링 횟수 */
  max_resample_attempts?: number;
}

/** ARHA AnalysisData에서 미들웨어로 넘어오는 감성 입력 */
export interface ARHAAnalysisInput {
  psi:            { x: number; y: number; z: number };
  expressionMode: string;
  trajectory:     string;
  surge_risk:     number;
  resonance:      number;
  delta_psi:      number;
  kappa:          number;
  emotion_label?: string;
}

/** 전체 파이프라인 최종 출력 */
export interface MiddlewarePipelineResult {
  /** 모달리티별 기술 프롬프트 */
  modality_prompts:    ModalityPrompts;
  /** 생성된 수식 */
  equation:            string;
  /** 내러티브 요약 */
  narrative:           string;
  /** LLM 파라미터 */
  temperature:         number;
  top_p:               number;
  /** 앵커 계층 */
  anchor_hierarchy:    AnchorHierarchy;
  /** 7D 블렌딩 벡터 */
  blended_vector:      Vector7D;
  /** 품질 보고서 (enable_quality_gate 시) */
  quality_report?:     QualityReport;
  /** 역방향 번역 */
  reverse_translation: ReverseTranslation;
  /** 업데이트된 하네스 상태 */
  updated_state?:      HarnessState;
  /** 레이어별 중간 데이터 (디버그용) */
  debug?: {
    input_object:       InputObject;
    semantic_units:     SemanticUnitArray;
    vector_field:       ConnectedVectorField;
    equation_package:   VerifiedEquationPackage;
  };
}
