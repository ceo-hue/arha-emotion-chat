
export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
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
