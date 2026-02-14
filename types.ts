
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

export interface AnalysisData {
  psi: { x: number; y: number; z: number };
  phi: string;
  sentiment: string;
  resonance: number;
  summary: string;
  tags: string[];
}

export enum ArhaMode {
  Neutral = 'Neutral',
  Protective = 'Protective',
  SoftTone = 'SoftTone',
  Direct = 'Direct',
  Subconscious = 'Subconscious'
}
