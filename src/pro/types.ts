// Adapted from: hisol-unified-mcp/src/types/hisol-emotion.ts + core/types.ts @ v1.0
// Browser-compatible internal types for PRO mode engines

export interface EmotionVector {
  valence: number;    // -1 (부정) ~ +1 (긍정)
  arousal: number;    //  0 (차분) ~ +1 (활성)
  intensity: number;  //  0 (약)   ~ +1 (강)
}

export interface EmotionProcessInput {
  input: string;
  mode: 'auto' | 'basic' | 'advanced' | 'fusion';
  sessionHistory?: string[];
  culturalContext?: string;
  emotionHint?: Partial<EmotionVector>;
}

export interface EmotionProcessResult {
  primaryEmotion: string;
  emotionVector: EmotionVector;
  confidence: number;
  emotionTags: string[];
  processingMode: string;
  layer1_surface?: string;   // 표면 감정
  layer3_social?: string;    // 사회적 맥락
  layer5_cognitive?: string; // 인지 부하
}

export interface TriggerScore {
  persona: string;
  score: number;
  reasons: string[];
}

export interface TriggerResult {
  selected_personas: string[];
  scores: TriggerScore[];
  reasoning: string;
  trigger_mode: 'auto' | 'manual';
}

export interface TechContext {
  project_context: {
    frameworks: string[];
    languages: string[];
    tools: string[];
    patterns: string[];
  };
  session_tech_count: number;
}
