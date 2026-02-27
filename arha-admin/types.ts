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
  functionLanguage: string;
  weight: number;
}

export interface ActiveEssenceBlock extends EssenceBlock {
  weight: number;
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
  matchedKeywords: string[];
  totalExpectedKeywords: number;
  timestamp: number;
}

export interface CanvasState {
  selectedPersonaId: string;
  activeBlocks: ActiveEssenceBlock[];
}
