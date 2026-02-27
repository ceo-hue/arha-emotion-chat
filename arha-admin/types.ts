// ── XYZ Vector Axes ──
// X: 객관성 (Objectivity)  → 외부지식 기반 판단
// Y: 주체성 (Subjectivity)  → 가치사슬/페르소나 관점
// Z: 본질성 (Essence)       → 키워드의 물리적 특성(온도/거리/밀도 등)

export interface VectorXYZ {
  x: number; // 0.0 ~ 1.0 — 객관성 가중치
  y: number; // 0.0 ~ 1.0 — 주체성 가중치
  z: number; // 0.0 ~ 1.0 — 본질성 가중치
}

/** 키워드의 물성(物性) 속성 */
export interface EssenceProperty {
  temperature: number;  // -1.0(차가움) ~ 1.0(뜨거움)
  distance: number;     // -1.0(가까움) ~ 1.0(멂)
  density: number;      // -1.0(가벼움) ~ 1.0(무거움)
  speed: number;        // -1.0(느림) ~ 1.0(빠름)
  brightness: number;   // -1.0(어두움) ~ 1.0(밝음)
}

export interface ValueChainItem {
  id: string;
  name: string;
  weight: number;
  activated: boolean;
}

export interface EssenceBlock {
  id: string;
  name: string;
  nameEn: string;
  emoji: string;
  category: 'philosophy' | 'emotion' | 'creativity' | 'expression';
  description: string;
  descriptionEn: string;

  /** 함수 표기: e.g. Logic_Epistemology(t), Emotion_Empathy(t) */
  funcNotation: string;

  /** XYZ 해석 규칙 */
  interpretX: string; // 객관성 시선으로 해석할 때의 규칙
  interpretY: string; // 주체 역량으로 해석할 때의 규칙
  interpretZ: string; // 물성 기반 해석 규칙

  /** 키워드 물성 프로필 */
  essenceProperties: EssenceProperty;

  /** 갈등지수 매칭용 핵심 키워드 */
  keywords: string[];

  /** 기본 벡터 값 */
  defaultVector: VectorXYZ;
}

export interface ActiveEssenceBlock extends EssenceBlock {
  vector: VectorXYZ; // 사용자가 조절한 XYZ 값
}

export interface PersonaPreset {
  id: string;
  label: string;
  emoji: string;
  description: string;
  descriptionEn: string;
  valueChain: ValueChainItem[];
  tonePromptSummary: string;
}

export interface TestResult {
  response: string;
  conflictIndex: number;
  vectorDistance: number;          // 코사인 유사도 기반 벡터 거리
  matchedKeywords: string[];
  totalExpectedKeywords: number;
  axisBreakdown: {                 // 축별 기여도
    x: number;
    y: number;
    z: number;
  };
  timestamp: number;
}

export interface CanvasState {
  selectedPersonaId: string;
  activeBlocks: ActiveEssenceBlock[];
}
