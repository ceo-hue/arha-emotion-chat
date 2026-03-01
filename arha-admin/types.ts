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

// ── 연산자 타입 (Operator Type) ──
// 블록이 상태공간에서 어떻게 작동하는지를 결정하는 함수언어 타입
export type OperatorType = 'transform' | 'gate' | 'amplify' | 'restructure';

/** 연산자 타입별 메타 정보 */
export const OPERATOR_META: Record<OperatorType, {
  labelKo: string;
  labelEn: string;
  notation: string;       // 수학적 표기
  color: string;          // Tailwind text color
  bgColor: string;        // Tailwind bg color
  borderColor: string;    // Tailwind border color
  descKo: string;
}> = {
  transform: {
    labelKo: '변환',
    labelEn: 'Transform',
    notation: 'Ψ→Ψ′',
    color: 'text-sky-400',
    bgColor: 'bg-sky-500/15',
    borderColor: 'border-sky-400/30',
    descKo: '입력 상태를 새로운 상태로 전환',
  },
  gate: {
    labelKo: '게이트',
    labelEn: 'Gate',
    notation: 'Ψ→{0,1}',
    color: 'text-amber-400',
    bgColor: 'bg-amber-500/15',
    borderColor: 'border-amber-400/30',
    descKo: '조건 충족 시에만 활성화',
  },
  amplify: {
    labelKo: '증폭',
    labelEn: 'Amplify',
    notation: 'Ψ→kΨ',
    color: 'text-emerald-400',
    bgColor: 'bg-emerald-500/15',
    borderColor: 'border-emerald-400/30',
    descKo: '현재 상태 강도를 높임',
  },
  restructure: {
    labelKo: '재구성',
    labelEn: 'Restructure',
    notation: 'Ψ→TΨ',
    color: 'text-violet-400',
    bgColor: 'bg-violet-500/15',
    borderColor: 'border-violet-400/30',
    descKo: '구조를 분해하여 재배열',
  },
};

/** 연산자 타입 순환 순서 */
export const OPERATOR_CYCLE: OperatorType[] = ['transform', 'gate', 'amplify', 'restructure'];

/** 연산자 타입별 LLM 행동 지시문 (프롬프트 주입용) */
export const OPERATOR_DIRECTIVES: Record<OperatorType, string> = {
  transform:   'TRANSFORM: Convert the input state into a distinctly new output state. Actively shift the perspective, framing, or emotional register of the response.',
  gate:        'GATE: Evaluate conditions before engaging. Only apply this dimension fully when the threshold is reached. Hold back if conditions are not met.',
  amplify:     'AMPLIFY: Intensify what is already present — do not change direction or add new content. Increase magnitude, depth, and resonance.',
  restructure: 'RESTRUCTURE: Deconstruct the premise. Break down implicit assumptions, then reassemble into a new structural configuration.',
};

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
  category: 'philosophy' | 'emotion' | 'creativity' | 'expression' | 'systems';
  description: string;
  descriptionEn: string;

  /** 함수 표기: e.g. Logic_Epistemology(t), Emotion_Empathy(t) */
  funcNotation: string;

  /** 연산자 타입 — 블록이 상태공간에서 어떻게 동작하는가 */
  operatorType: OperatorType;

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

/** 블록 역할: Main = 주력 지시, Supporter = 보조 색채 */
export type BlockRole = 'main' | 'supporter';

/** 역할별 고정 영향력 (%) */
export const INFLUENCE_MAP = {
  main: 0.70,          // 70% — PRIMARY DIRECTIVE
  supporter: [         // 나머지 30% 분배
    0.15,              // Supporter #1: 15%
    0.10,              // Supporter #2: 10%
    0.05,              // Supporter #3: 5%
  ],
} as const;

export const MAX_SUPPORTERS = 3;

export interface ActiveEssenceBlock extends EssenceBlock {
  vector: VectorXYZ;        // 사용자가 조절한 XYZ 값
  role: BlockRole;           // 'main' | 'supporter'
  influence: number;         // 0.0 ~ 1.0 — 자동 계산된 영향력
  // operatorType은 EssenceBlock에서 상속 (사용자가 override 가능)
}

// ── 페르소나 동적 트리거 (Persona Dynamic Trigger) ──
// 사용자 입력에서 특정 조건이 감지될 때 자동으로 연산자 모드를 전환
export interface PersonaTrigger {
  id: string;
  labelKo: string;
  labelEn: string;
  emoji: string;
  conditionKeywords: string[];   // 이 키워드들이 감지되면 트리거 활성화
  conditionDesc: string;         // 활성화 조건 설명
  responseDirective: string;     // 활성화 시 LLM에게 주입할 지시문
  preferredOperator: OperatorType; // 트리거 시 권장 연산자 모드
}

export interface PersonaPreset {
  id: string;
  label: string;
  emoji: string;
  description: string;
  descriptionEn: string;
  valueChain: ValueChainItem[];
  tonePromptSummary: string;     // 짧은 요약 (어드민 테스트용)
  tonePromptFull?: string;       // 완전한 페르소나 프롬프트 (시스템 프롬프트 내보내기용)
  triggers: PersonaTrigger[];   // 동적 트리거 목록
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
  activatedTriggers: string[];     // 활성화된 트리거 ID 목록
  timestamp: number;
}

export interface CanvasState {
  selectedPersonaId: string;
  activeBlocks: ActiveEssenceBlock[];
}
