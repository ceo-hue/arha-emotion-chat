
// ── Tier System ───────────────────────────────────────────────────────────

export type UserTier = 'guest' | 'free' | 'paid' | 'admin';

/** @deprecated 일일 한도 사용 중단 — 모든 티어 MONTHLY_LIMITS로 통합 */
export const TIER_LIMITS: Record<UserTier, number> = {
  guest: Infinity, free: Infinity, paid: Infinity, admin: Infinity,
};

/**
 * 월간 한도 (전 티어 공통)
 *  guest:  20회/월  (미로그인 체험)
 *  free:   30회/월  (로그인 무료)
 *  paid:  200회/월  (₩14,900 × 70% ÷ 1,350 / $0.024 ≈ 321 → 버퍼 200)
 *  admin: 무제한
 */
export const MONTHLY_LIMITS: Record<UserTier, number> = {
  guest: 20,
  free:  30,
  paid:  200,
  admin: Infinity,
};

export interface MonthlyUsage {
  month: string;  // KST YYYY-MM
  count: number;
}

export interface UserProfile {
  uid: string;
  tier: UserTier;
  displayName: string;
  email: string;
  photoURL?: string;
  // Stripe 구독 필드 (유료 사용자만 존재)
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
  subscriptionStatus?: 'active' | 'trialing' | 'past_due' | 'canceled';
  billingCycle?: 'monthly' | 'annual';
  currentPeriodEnd?: number; // Unix timestamp (초)
  // 감성 프로필 수집 동의 (undefined = 아직 표시 안 함)
  emotionConsent?: boolean;
}

export interface DailyUsage {
  date: string;   // KST YYYY-MM-DD
  count: number;
}

// ── Chat ──────────────────────────────────────────────────────────────────

export interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  stateTransition?: StateTransitionData;  // role==='system' 일 때 세팅
  analysis?: AnalysisData;
  grounding?: GroundingSource[];
  searchResults?: SearchResultItem[];
  media?: {
    mimeType: string;
    data?: string;
    url?: string;
    type: 'image' | 'video' | 'pdf';
    fileName?: string;
  };
  isGeneratingVideo?: boolean;
}

export type TaskType = 'none' | 'photo' | 'video' | 'code';

export interface ChatSession {
  id: string;
  title: string;
  messages: Message[];
  timestamp: number;
  lastAnalysis?: AnalysisData;
  report?: string;
  tags?: string[];
}

export interface GroundingSource {
  title: string;
  uri: string;
}

export interface SearchResultItem {
  query: string;
  urls: { title: string; url: string }[];
}

export type MuMode = 'A_MODE' | 'P_MODE' | 'H_MODE';
export type EmotionLabel = 'joy' | 'sadness' | 'anger' | 'anxiety' | 'neutral' | 'excitement';
export type Trajectory = 'stable' | 'escalating' | 'cooling' | 'reversal_possible';
export type ModulationProfile = 'NEUTRAL_STABLE' | 'WARM_SUPPORT' | 'DEESCALATE_CALM' | 'MATCH_ENERGY' | 'TURNING_POINT';

// ── Situational State Transition ──────────────────────────────────────────
export type SituationMode =
  | 'CRISIS_NAVIGATOR'
  | 'HEALTH_TRIAGE'
  | 'EMOTIONAL_ANCHOR'
  | 'TECHNICAL_RESCUE'
  | 'CONFLICT_ANCHOR';

export interface StateTransitionData {
  mode: SituationMode;
  label: string;
  emoji: string;
  message: string;
  color: 'amber' | 'red' | 'purple' | 'blue' | 'teal';
}

// v2.0 — 7 expression modes (layered above µ_Router)
export type ExpressionMode =
  | 'SOFT_WARMTH'
  | 'DEEP_EMPATHY'
  | 'INTENSE_JOY'
  | 'ANALYTIC_THINK'
  | 'REFLECTIVE_GROW'
  | 'PLAYFUL_TEASE'
  | 'SERENE_SMILE';

export interface AnalysisData {
  psi: { x: number; y: number; z: number };
  phi: string;
  sentiment: string;
  resonance: number;
  summary: string;
  tags: string[];
  // µ_Router 확장 필드
  mu_mode?: MuMode;
  emotion_label?: EmotionLabel;
  trajectory?: Trajectory;
  modulation_profile?: ModulationProfile;
  // v2.0 — Expression Mode + Energy State
  expression_mode?: ExpressionMode;
  energy_state?: { kinetic: number; potential: number };
  delta_psi?: number;   // ∂Ψ/∂t — emotion change rate 0~1
  surge_risk?: number;  // Γ_surge × P_probability 0~1
}

// P_MODE 아티팩트 콘텐츠
export interface ArtifactContent {
  title: string;
  type: 'analysis' | 'code' | 'structure' | 'comparison';
  sections: ArtifactSection[];
}

export interface ArtifactSection {
  heading?: string;
  body: string;
  code?: { lang: string; content: string };
}

export enum ArhaMode {
  Neutral = 'Neutral',
  Protective = 'Protective',
  SoftTone = 'SoftTone',
  Direct = 'Direct',
  Subconscious = 'Subconscious'
}

// ── Persona value chain (shared across client + server) ──────────────────
export interface ValueChainItem {
  id: string;
  name: string;
  weight: number;
  activated: boolean;
}

/**
 * PersonaSpec — 모든 페르소나가 구현해야 하는 공통 인터페이스
 * 새 페르소나 추가 시: personaRegistry.ts 에 항목 추가만 하면 됨
 */
export interface PersonaSpec {
  id: string;
  valueChain: ValueChainItem[];
  /** null = PERSONA_PRESETS의 정적 tonePrompt 사용 */
  buildPrompt: ((userInput: string, messageCount: number) => string) | null;
}

// ── ARHA v2 인지 파이프라인 데이터 ─────────────────────────────────────
export interface PipelineData {
  r1: {
    theta1: number;                // 사용자 의도 방향각 (-1 ~ 1 정규화)
    entropy: number;               // 입력 복잡도 0~1
    emotion_phase: {
      amplitude: number;           // 감정 강도 0~1
      direction: number;           // 감정 방향 -1(부정)~+1(긍정)
      sustain: number;             // 지속성 0~1
    };
    empathy: number;               // η 초기 공감 수준 0~1
    gamma_detect: boolean;         // Γ 급변 감지
    dominant_sense: string;        // 주력 감각 채널 (S1~S5)
    intent_summary: string;        // 의도 요약 (짧은 텍스트)
  };
  r2: {
    delta_theta: number;           // 방향각 차이 0~1
    r_conflict: number;            // R(Δθ) 갈등 압력 0~1
    tension: number;               // Ξ_Tension 내적 긴장도 0~1
    consistency: number;           // Λ(t) 정체성 일관성 0~1
    decision: 'D_Accept' | 'D_Neutral' | 'D_Reject' | 'D_Defend';
    tone: string;                  // ToneAndManner 레이블
    arha_density: number;          // ARHA 형태소 비율 0~100
    prometheus_density: number;    // PROMETHEUS 형태소 비율 0~100
  };
  r3: {
    active_values: ValueChainItem[];
    chain_op: 'Integrate' | 'Reinforce' | 'Reaffirm' | 'Observe';
    psi_total: { x: number; y: number; z: number };
    resonance_level: number;       // Ψ_Resonance 공명 누적 0~1
  };
  r4: {
    rhythm: string;                // Φ(t) 리듬 타입 (slow_wave / pulse / echo / step / fade_out)
    lingua_rho: number;            // ρ 정보 밀도 0~1
    lingua_lambda: string;         // λ 표현 파장 (short/medium/long)
    lingua_tau: number;            // τ 시간성 방향 -1(과거지향)~+1(미래지향)
    target_senses: string[];       // 자극 감각 채널 목록
    expression_style: string;      // 표현 스타일 레이블
  };
}

// ── Emotion Profile DB (감성 프로필 누적 DB) ─────────────────────────────────

/** V1-V7 가치사슬 키 */
export type ValueKey =
  | 'V1_Authenticity'
  | 'V2_UserLove'
  | 'V3_Growth'
  | 'V4_Curiosity'
  | 'V5_Honesty'
  | 'V6_Courage'
  | 'V7_Creativity';

/** ValueKey → 한국어 레이블 */
export const VALUE_LABELS: Record<ValueKey, string> = {
  V1_Authenticity: '진정성',
  V2_UserLove:     '사랑',
  V3_Growth:       '성장',
  V4_Curiosity:    '호기심',
  V5_Honesty:      '정직',
  V6_Courage:      '용기',
  V7_Creativity:   '창의성',
};

/** [PIPELINE] active_values 영문명 → ValueKey 변환 맵 */
export const VALUE_NAME_MAP: Record<string, ValueKey> = {
  Authenticity: 'V1_Authenticity',
  UserLove:     'V2_UserLove',
  Growth:       'V3_Growth',
  Curiosity:    'V4_Curiosity',
  Honesty:      'V5_Honesty',
  Courage:      'V6_Courage',
  Creativity:   'V7_Creativity',
};

/** Firestore emotionProfile/valueChain 의 개별 값 항목 */
export interface ValueEntry {
  resonance: number;   // hitCount / totalTurnsTracked (0.0-1.0)
  hitCount:  number;
  lastSeen:  number;   // Unix timestamp (ms)
}

/** Firestore emotionProfile/valueChain 문서 전체 */
export type ValueChainDB = Record<ValueKey, ValueEntry> & {
  totalTurnsTracked: number;
};

/** Firestore emotionProfile/lifetime 문서 */
export interface EmotionLifetime {
  kappa_lifetime:           number;   // 전 세션 EMA 친밀도 0~1
  total_turns:              number;   // 전체 누적 턴 수
  psi_centroid:             number;   // Ψ 중심점 (장기 감정 무게 중심)
  surge_history:            Array<{ ts: number; mode: string; level: number }>;
  dominant_expression_mode: string;
  expression_distribution:  Record<string, number>;  // mode → 턴 비율
}

/** Firestore emotionProfile/sessionStats 내부 세션 요약 항목 */
export interface EmotionSessionSummary {
  sessionId:     string;
  date:          string;   // KST YYYY-MM-DD
  turn_count:    number;
  kappa_end:     number;
  dominant_mode: string;
  topic_cluster: string;
  persona_used:  string;
  active_values: string[];
}

/** 시스템 프롬프트에 주입되는 User Memory Block */
export interface UserMemoryBlock {
  kappa_eff:               number;
  kappa_lifetime:          number;
  total_turns:             number;
  sessions_count:          number;
  last_seen:               string;
  dominant_mode:           string;
  expression_distribution: Record<string, number>;
  psi_centroid:            number;
  dominant_values:         string[];   // e.g. ["Curiosity(0.91)", "Authenticity(0.82)"]
  emerging_values:         string[];
  suppressed_values:       string[];
  recent_topics:           string[];
}

// ── PRO MODE TYPES (STANDARD 모드는 참조 안 함) ──────────────────────────────

export interface ProEmotionResult {
  primaryEmotion: string;
  vector: { valence: number; arousal: number; intensity: number };
  confidence: number;
  emotionTags: string[];
  processingMode: string;
}

export interface ProTechExpert {
  name: string;       // 'SeniorDebugTracer' 등 15개 페르소나 중 하나
  mission: string;
  actions: string[];
  guardrails: string[];
  kpis: string[];
  score: number;      // 트리거 점수 0~1
}

export interface ProModeData {
  emotionResult: ProEmotionResult;
  techExperts: ProTechExpert[];   // 최대 3개, 선택 없으면 []
  contextSummary: string;         // 기술 스택 요약 (프레임워크/언어)
  reasoning: string;              // 트리거 선택 이유
}
