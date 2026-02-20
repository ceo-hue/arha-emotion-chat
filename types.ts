
export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  analysis?: AnalysisData;
  grounding?: GroundingSource[];
  media?: {
    mimeType: string;
    data?: string;
    url?: string;
    type: 'image' | 'video';
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
