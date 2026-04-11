/**
 * ARHA 함수언어 미들웨어 — 상수 정의
 * 8축 심볼 라이브러리, 골든벡터, 연산자, 앵커 등
 */

import type {
  Axis, DimensionAnchor, BridgeOperator, GVId,
  AxisWeights, Vector7D,
} from './types';

// ─────────────────────────────────────────
// 8축 → 그리스 문자 매핑
// ─────────────────────────────────────────

export const AXIS_SYMBOL: Record<Axis, string> = {
  emotion:  'Ψ',
  visual:   'σ',
  rhythm:   'Φ',
  state:    'Λ',
  relation: 'Θ',
  video:    'M',
  physics:  'G',
  music:    'Mel',
};

// ─────────────────────────────────────────
// 심볼 라이브러리 (Vol.2 기반)
// ─────────────────────────────────────────

export interface SymbolDef {
  symbol:     string;
  axis:       Axis;
  role:       string;
  semantics:  string[];  // 매핑되는 의미 키워드
}

export const SYMBOL_LIBRARY: SymbolDef[] = [
  // Emotion (Ψ)
  { symbol: 'Ψ',    axis: 'emotion',  role: 'emotion_master',    semantics: ['감정','emotion','feel','느낌','기분'] },
  { symbol: 'ρ',    axis: 'emotion',  role: 'emotion_density',   semantics: ['농밀','density','깊이','진함'] },
  { symbol: 'm',    axis: 'emotion',  role: 'emotion_mass',      semantics: ['무게','weight','burden','짐','중압'] },
  // Visual (σ)
  { symbol: 'σ',    axis: 'visual',   role: 'surface_style',     semantics: ['시각','visual','보이는','장면','scene'] },
  { symbol: 'L',    axis: 'visual',   role: 'lighting',          semantics: ['빛','light','조명','밝기','glow'] },
  { symbol: 'C',    axis: 'visual',   role: 'camera',            semantics: ['카메라','camera','시점','앵글','angle'] },
  { symbol: 'D',    axis: 'visual',   role: 'depth',             semantics: ['깊이','depth','원근','distance','층'] },
  { symbol: 'R_v',  axis: 'visual',   role: 'composition',       semantics: ['구도','composition','배치','layout'] },
  { symbol: 'S',    axis: 'visual',   role: 'scene',             semantics: ['공간','space','장소','place','배경'] },
  // Rhythm (Φ)
  { symbol: 'Φ',    axis: 'rhythm',   role: 'rhythm_master',     semantics: ['리듬','rhythm','호흡','pace','템포'] },
  { symbol: 'N',    axis: 'rhythm',   role: 'length',            semantics: ['길이','length','짧은','긴','duration'] },
  // State (Λ)
  { symbol: 'Λ',    axis: 'state',    role: 'alignment',         semantics: ['상태','state','정렬','일관성','consistency'] },
  { symbol: 'Ω',    axis: 'state',    role: 'cognitive',         semantics: ['인지','cognitive','사고','생각','think'] },
  { symbol: '∂',    axis: 'state',    role: 'delta',             semantics: ['변화','change','흐름','전환','shift'] },
  { symbol: 'I',    axis: 'state',    role: 'information',       semantics: ['정보','information','지식','data','사실'] },
  // Relation (Θ)
  { symbol: 'Θ',    axis: 'relation', role: 'relational_dist',   semantics: ['관계','relation','거리','distance','연결'] },
  { symbol: 'η',    axis: 'relation', role: 'empathy',           semantics: ['공감','empathy','이해','understand','공명'] },
  { symbol: 'R_r',  axis: 'relation', role: 'balance',           semantics: ['균형','balance','조화','harmony','대칭'] },
  // Video (M)
  { symbol: 'M',    axis: 'video',    role: 'motion',            semantics: ['움직임','motion','dynamic','동작','이동'] },
  { symbol: 'T_v',  axis: 'video',    role: 'tempo',             semantics: ['속도','tempo','빠른','느린','slow','fast'] },
  { symbol: 'Dir',  axis: 'video',    role: 'direction',         semantics: ['방향','direction','흐름','flow'] },
  { symbol: 'DL',   axis: 'video',    role: 'dynlight',          semantics: ['동적조명','dynamic_light','플리커','flicker'] },
  // Physics (G)
  { symbol: 'G',    axis: 'physics',  role: 'gravity',           semantics: ['중력','gravity','무게감','pull','끌림'] },
  { symbol: 'Fl',   axis: 'physics',  role: 'fluid',             semantics: ['유체','fluid','흐름','flow','액체'] },
  { symbol: 'F',    axis: 'physics',  role: 'force',             semantics: ['힘','force','충격','impact','에너지'] },
  { symbol: 'Ent',  axis: 'physics',  role: 'entropy',           semantics: ['혼돈','entropy','무질서','chaos','산산'] },
  // Music (Mel)
  { symbol: 'Mel',  axis: 'music',    role: 'melody',            semantics: ['멜로디','melody','선율','음정','tune'] },
  { symbol: 'H',    axis: 'music',    role: 'harmony',           semantics: ['화음','harmony','코드','chord','협화'] },
  { symbol: 'R_m',  axis: 'music',    role: 'music_rhythm',      semantics: ['박자','beat','리듬','rhythm','BPM'] },
  { symbol: 'Tex',  axis: 'music',    role: 'texture',           semantics: ['음색','timbre','texture','질감','소리'] },
];

// ─────────────────────────────────────────
// 차원 앵커 (Semantic Space)
// ─────────────────────────────────────────

export const DIMENSION_ANCHOR_MAP: Record<DimensionAnchor, string> = {
  ST: 'State — 감정/심리적 상태',
  TM: 'Time — 시간적 흐름/지속',
  RL: 'Relation — 대인관계 역학',
  SP: 'Space — 물리적 공간/장면',
  NV: 'Non-Verbal — 소리/음악/촉감',
  EX: 'Expression — 힘/흐름/혼돈',
};

/** 키워드 → 차원 앵커 매핑 (Layer 1에서 사용) */
export const KEYWORD_TO_ANCHOR: Record<string, DimensionAnchor> = {
  // TM
  '새벽': 'TM', '아침': 'TM', '밤': 'TM', '시간': 'TM', '순간': 'TM',
  '오래': 'TM', '천천히': 'TM', '기다림': 'TM', 'dawn': 'TM', 'night': 'TM',
  // SP
  '비': 'SP', '빗소리': 'NV', '거리': 'SP', '공간': 'SP', '장소': 'SP',
  '아스팔트': 'SP', '도시': 'SP', '방': 'SP', 'street': 'SP', 'room': 'SP',
  // NV
  '소리': 'NV', '음악': 'NV', '목소리': 'NV', '노래': 'NV', '침묵': 'NV',
  'sound': 'NV', 'music': 'NV', 'silence': 'NV',
  // ST
  '기분': 'ST', '감정': 'ST', '마음': 'ST', '슬픔': 'ST', '기쁨': 'ST',
  '외로움': 'ST', '고독': 'ST', 'lonely': 'ST', 'sad': 'ST', 'happy': 'ST',
  // RL
  '혼자': 'RL', '함께': 'RL', '너': 'RL', '우리': 'RL', '관계': 'RL',
  '사랑': 'RL', 'alone': 'RL', 'together': 'RL', 'love': 'RL',
  // EX
  '힘': 'EX', '에너지': 'EX', '폭풍': 'EX', '흐름': 'EX', '충돌': 'EX',
  'force': 'EX', 'energy': 'EX', 'storm': 'EX',
};

// ─────────────────────────────────────────
// 브릿지 연산자 우선순위
// ─────────────────────────────────────────

export interface OperatorDef {
  symbol:    BridgeOperator;
  priority:  1 | 2 | 3 | 4;
  type:      'unary' | 'multiplicative' | 'additive' | 'directional';
  meaning:   string;
  ko_word:   string; // 역방향 번역용
}

export const BRIDGE_OPERATORS: OperatorDef[] = [
  { symbol: '√',    priority: 1, type: 'unary',         meaning: 'Extract core essence',        ko_word: '의 본질' },
  { symbol: 'd/dt', priority: 1, type: 'unary',         meaning: 'Instantaneous rate of change', ko_word: '의 순간 변화' },
  { symbol: 'A/B',  priority: 2, type: 'multiplicative', meaning: 'Relative weight ratio',       ko_word: '에 비례하여' },
  { symbol: '⊗',    priority: 2, type: 'multiplicative', meaning: 'Tensor modulation (nonlinear)', ko_word: '과 만나' },
  { symbol: '⊕',    priority: 3, type: 'additive',      meaning: 'Direct sum (independent)',     ko_word: '와 함께' },
  { symbol: '∫',    priority: 3, type: 'additive',      meaning: 'Integration over time',        ko_word: '누적' },
  { symbol: '∇',    priority: 4, type: 'directional',   meaning: 'Directional flow / gradient',  ko_word: '방향으로' },
];

// ─────────────────────────────────────────
// 골든 벡터 (GV) 정의
// ─────────────────────────────────────────

export interface GoldenVector {
  id:              GVId;
  domain:          string;
  description:     string;
  blend_ratio:     number;        // 블렌딩 가중치
  expert_weight:   number;        // 전문성 가중치 (자동 조정)
  base_vector:     Vector7D;      // 도메인 기본 7D 벡터
  axis_bias:       Partial<AxisWeights>; // 강조 축
  quality_floor:   number;        // 최소 품질 기준
  personality_vectors: string[];  // 특성 키워드
}

export const GOLDEN_VECTORS: Record<GVId, GoldenVector> = {
  GV_ARHA_Conversation: {
    id: 'GV_ARHA_Conversation',
    domain: 'conversation',
    description: '감성 대화 — 따뜻하고 공감적인 응답',
    blend_ratio: 0.85,
    expert_weight: 0.90,
    base_vector: { I: 0.65, D: 0.60, E: 0.35, T: 0.50, S: 0.75, C: 0.80, R: 0.60 },
    axis_bias: { emotion: 0.90, relation: 0.80, rhythm: 0.70 },
    quality_floor: 0.65,
    personality_vectors: ['warm', 'empathetic', 'resonant', 'sincere'],
  },
  GV_Cinematic_Noir_v2: {
    id: 'GV_Cinematic_Noir_v2',
    domain: 'cinematic',
    description: '시네마틱 느와르 v2 — 영상/이미지 생성 전문',
    blend_ratio: 0.90,
    expert_weight: 0.88,
    base_vector: { I: 0.78, D: 0.72, E: 0.40, T: 0.65, S: 0.40, C: 0.75, R: 0.45 },
    axis_bias: { visual: 0.95, video: 0.85, physics: 0.60 },
    quality_floor: 0.70,
    personality_vectors: ['cinematic', 'atmospheric', 'moody', 'precise'],
  },
  GV_Cinematic_Noir_v1: {
    id: 'GV_Cinematic_Noir_v1',
    domain: 'cinematic',
    description: '시네마틱 느와르 v1 — 레거시',
    blend_ratio: 0.80,
    expert_weight: 0.75,
    base_vector: { I: 0.72, D: 0.68, E: 0.42, T: 0.60, S: 0.42, C: 0.70, R: 0.48 },
    axis_bias: { visual: 0.88, video: 0.78 },
    quality_floor: 0.65,
    personality_vectors: ['cinematic', 'moody'],
  },
  GV_Code_Generation: {
    id: 'GV_Code_Generation',
    domain: 'code',
    description: '코드 생성 — 정밀하고 구조적',
    blend_ratio: 0.95,
    expert_weight: 0.92,
    base_vector: { I: 0.92, D: 0.85, E: 0.15, T: 0.40, S: 0.30, C: 0.95, R: 0.25 },
    axis_bias: { state: 0.95, rhythm: 0.60 },
    quality_floor: 0.75,
    personality_vectors: ['precise', 'structured', 'minimal', 'efficient'],
  },
  GV_Design_Spring: {
    id: 'GV_Design_Spring',
    domain: 'design',
    description: '디자인 스프링 — 미적 구성',
    blend_ratio: 0.85,
    expert_weight: 0.82,
    base_vector: { I: 0.75, D: 0.65, E: 0.45, T: 0.55, S: 0.60, C: 0.78, R: 0.50 },
    axis_bias: { visual: 0.90, relation: 0.65 },
    quality_floor: 0.68,
    personality_vectors: ['aesthetic', 'balanced', 'creative', 'harmonic'],
  },
  GV_Research: {
    id: 'GV_Research',
    domain: 'research',
    description: '리서치 — 분석적이고 포괄적',
    blend_ratio: 0.90,
    expert_weight: 0.85,
    base_vector: { I: 0.88, D: 0.80, E: 0.25, T: 0.50, S: 0.35, C: 0.90, R: 0.40 },
    axis_bias: { state: 0.88, relation: 0.55 },
    quality_floor: 0.72,
    personality_vectors: ['analytical', 'thorough', 'objective', 'structured'],
  },
  GV_Technical_Design: {
    id: 'GV_Technical_Design',
    domain: 'technical',
    description: '기술 설계 — 정밀 + 미적',
    blend_ratio: 0.88,
    expert_weight: 0.86,
    base_vector: { I: 0.85, D: 0.78, E: 0.22, T: 0.45, S: 0.55, C: 0.88, R: 0.38 },
    axis_bias: { state: 0.90, visual: 0.75 },
    quality_floor: 0.70,
    personality_vectors: ['precise', 'elegant', 'functional'],
  },
  GV_System_Default: {
    id: 'GV_System_Default',
    domain: 'general',
    description: '시스템 기본값 — 폴백',
    blend_ratio: 0.70,
    expert_weight: 0.70,
    base_vector: { I: 0.70, D: 0.65, E: 0.35, T: 0.50, S: 0.50, C: 0.70, R: 0.50 },
    axis_bias: {},
    quality_floor: 0.60,
    personality_vectors: ['balanced'],
  },
};

// ─────────────────────────────────────────
// 앵커 모드 임계값
// ─────────────────────────────────────────

export const ANCHOR_MODE_THRESHOLDS = {
  triangle:  { min: 0,    max: 0.40 }, // 단일 축
  square:    { min: 0.40, max: 0.70 }, // 2축
  pentagon:  { min: 0.70, max: 0.90 }, // 3-4축
  equation:  { min: 0.90, max: 1.00 }, // 다축 복합
};

// ─────────────────────────────────────────
// 수학 규율 선택 기준
// ─────────────────────────────────────────

export const DISCIPLINE_SELECTION_RULES = {
  calculus:       { trigger: 'temporal_flow OR memory_trace OR gradual_change' },
  linear_algebra: { trigger: 'structural_composition OR parallel_states' },
  fluid_dynamics: { trigger: 'emotional_surge OR overflow OR release' },
  entropy_theory: { trigger: 'chaos OR dissolution OR complexity_high (E>0.7)' },
  harmonic:       { trigger: 'music_dominant OR oscillation OR resonance' },
};

// ─────────────────────────────────────────
// 7D 제약 관계 (C1-C6)
// ─────────────────────────────────────────

export const VECTOR_CONSTRAINTS = [
  { id: 'C1', rule: 'I_high → E_min 0.3',        desc: '고확신 → 최소 불확실성 보장' },
  { id: 'C2', rule: 'E_high → C_max inverse',     desc: '고엔트로피 → 응집도 역관계' },
  { id: 'C3', rule: 'S > 0.6 → T_adjusted',       desc: '고사회성 → 시간성 증폭' },
  { id: 'C4', rule: 'Resonance_high → R_decrease', desc: '고공명 → 상대성 감소' },
  { id: 'C5', rule: 'D_high AND I_high → synergy', desc: '고밀도+고확신 → 시너지 보너스' },
  { id: 'C6', rule: 'T_low → D_max capped',        desc: '저시간성 → 밀도 상한 제한' },
];

// ─────────────────────────────────────────
// 교차축 효과 규칙 (σ_AxisCrossEffect)
// ─────────────────────────────────────────

export const CROSS_AXIS_RULES = [
  { from: 'emotion',  to: 'rhythm',   effect: 'Ψ_high → Φ acceleration',     factor: 0.15 },
  { from: 'emotion',  to: 'visual',   effect: 'Ψ_high → σ_saturation_boost', factor: 0.10 },
  { from: 'physics',  to: 'video',    effect: 'G_high → M_intensity_boost',   factor: 0.20 },
  { from: 'music',    to: 'rhythm',   effect: 'Mel_high → Φ_synchronize',     factor: 0.18 },
  { from: 'relation', to: 'state',    effect: 'Θ_high → R_decrease',          factor: -0.12 },
  { from: 'state',    to: 'state',    effect: 'Λ_high → C_boost',             factor: 0.08 },
];

// ─────────────────────────────────────────
// 모달리티별 GV 우선순위
// ─────────────────────────────────────────

export const MODALITY_GV_PRIORITY: Record<string, GVId[]> = {
  video:      ['GV_Cinematic_Noir_v2', 'GV_Cinematic_Noir_v1', 'GV_System_Default'],
  image:      ['GV_Cinematic_Noir_v2', 'GV_Design_Spring',     'GV_System_Default'],
  music:      ['GV_ARHA_Conversation', 'GV_Cinematic_Noir_v2', 'GV_System_Default'],
  code:       ['GV_Code_Generation',   'GV_Technical_Design',  'GV_System_Default'],
  design:     ['GV_Design_Spring',     'GV_Technical_Design',  'GV_System_Default'],
  plan:       ['GV_Research',          'GV_ARHA_Conversation', 'GV_System_Default'],
  default:    ['GV_ARHA_Conversation', 'GV_System_Default'],
};

// ─────────────────────────────────────────
// Layer 4: Temperature/Top-P 기본값
// ─────────────────────────────────────────

export const TEMPERATURE_BASE = 0.7;
export const TOP_P_BASE       = 0.9;

// ─────────────────────────────────────────
// Layer 5: 품질 게이트 임계값
// ─────────────────────────────────────────

export const QUALITY_THRESHOLDS = {
  pass:          { total_score: 0.65, fidelity_score: 0.60 },
  diversity:     { total_score: 0.90 },
  resample:      { total_score_min: 0.40, max_attempts: 3 },
  fidelity_fix:  { fidelity_score: 0.60 },
};

export const QUALITY_WEIGHTS = {
  anchor_fit:       0.35,
  axis_coverage:    0.25,
  high_bias:        0.20,
  vector_alignment: 0.20,
};

// ─────────────────────────────────────────
// Layer 6: 메모리 설정
// ─────────────────────────────────────────

export const MEMORY_CONFIG = {
  mu_decay_rate:      0.1,    // e^(-0.1×Δt)
  resonance_decay:    0.1,    // Ψ_Resonance decay
  cache_ttl_days:     7,
  tier2_min_quality:  0.75,
  eureka_psi_spike:   0.5,    // ∂Ψ/∂t > 0.5
  eureka_curl:        0.75,   // |∇×V|² ≥ 0.75
  eureka_fit_jump:    0.3,    // anchor_fit_score +0.3
};

// ─────────────────────────────────────────
// ARHA expressionMode → Middleware 초기 축 가중치
// ─────────────────────────────────────────

export const EXPRESSION_MODE_AXIS_WEIGHTS: Record<string, Partial<AxisWeights>> = {
  DEEP_EMPATHY:    { emotion: 0.90, relation: 0.80, rhythm: 0.65 },
  SOFT_WARMTH:     { emotion: 0.80, relation: 0.75, rhythm: 0.70 },
  INTENSE_JOY:     { emotion: 0.85, physics: 0.60, video: 0.70 },
  ANALYTIC_THINK:  { state: 0.90, rhythm: 0.50, emotion: 0.40 },
  REFLECTIVE_GROW: { emotion: 0.75, state: 0.80, music: 0.60 },
  PLAYFUL_TEASE:   { emotion: 0.70, physics: 0.65, video: 0.75 },
  SERENE_SMILE:    { emotion: 0.65, visual: 0.75, rhythm: 0.80 },
};

// ─────────────────────────────────────────
// ARHA trajectory → T(Temporality) 초기값
// ─────────────────────────────────────────

export const TRAJECTORY_TO_T: Record<string, number> = {
  escalating:        0.75,
  cooling:           0.55,
  stable:            0.45,
  reversal_possible: 0.70,
};
