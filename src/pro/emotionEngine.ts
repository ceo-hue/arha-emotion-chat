// Adapted from: hisol-unified-mcp/src/engines/C-001_HISOLEmotionEngine.ts @ v1.0
// 7-layer emotion processing — pure algorithm, no external API calls

import type { EmotionProcessInput, EmotionProcessResult, EmotionVector } from './types';

// ── Layer 1: Surface keywords ─────────────────────────────────────────────────
const SURFACE_PATTERNS = {
  joy:       { kw: ['기쁘', '행복', '좋아', '즐거', '신나', '감사', '사랑', 'happy', 'joy', 'great', 'love', 'wonderful', 'amazing', '😊', '🎉', '❤️'], valence: 0.8, arousal: 0.6 },
  sadness:   { kw: ['슬프', '우울', '힘들', '외로', '그리워', '눈물', 'sad', 'depressed', 'lonely', 'miss', 'hurt', '😢', '😔'], valence: -0.7, arousal: 0.2 },
  anger:     { kw: ['화가', '짜증', '열받', '분노', '화남', '싫어', 'angry', 'annoyed', 'frustrated', 'hate', 'mad', '😡', '🤬'], valence: -0.8, arousal: 0.9 },
  anxiety:   { kw: ['불안', '걱정', '두려', '무서', '긴장', '떨림', 'anxious', 'worried', 'scared', 'nervous', 'fear', '😰', '😨'], valence: -0.5, arousal: 0.7 },
  excitement:{ kw: ['기대', '설레', '흥분', '두근', '신기', 'excited', 'thrilled', 'curious', 'interested', '🤩', '✨', '🚀'], valence: 0.7, arousal: 0.9 },
  neutral:   { kw: ['그냥', '보통', '평범', '그렇구나', 'okay', 'fine', 'neutral', 'just'], valence: 0, arousal: 0.3 },
  confusion: { kw: ['모르겠', '이해가', '헷갈', '왜', '어떻게', '모르', 'confused', "don't understand", 'why', 'how', '?', '??'], valence: -0.2, arousal: 0.5 },
  frustration:{ kw: ['안됨', '안되', '실패', '막혔', '포기', '못하', 'stuck', "can't", 'failed', 'broken', 'not working', "doesn't work"], valence: -0.6, arousal: 0.7 },
};

// ── Layer 3: Social context ───────────────────────────────────────────────────
const SOCIAL_PATTERNS = {
  help_seeking:  { kw: ['도움', '도와', '알려줘', 'help', 'please', 'can you'], weight: 0.3 },
  sharing:       { kw: ['얘기', '이야기', '말하고', '공유', 'share', 'tell you', 'wanted to say'], weight: 0.2 },
  technical:     { kw: ['코드', 'code', '함수', 'function', '에러', 'error', 'API', '버그', 'bug'], weight: 0.4 },
  urgency:       { kw: ['빨리', '급해', '지금', 'urgent', 'asap', 'immediately', 'now'], weight: 0.3 },
};

// ── Layer 5: Cognitive load ───────────────────────────────────────────────────
function estimateCognitiveLoad(text: string): number {
  const wordCount = text.split(/\s+/).length;
  const questionCount = (text.match(/\?|？/g) || []).length;
  const complexWords = (text.match(/[A-Z]{2,}|[가-힣]{4,}/g) || []).length;
  return Math.min(1, (wordCount / 50 + questionCount * 0.2 + complexWords * 0.05));
}

// ── Layer 7: Final fusion ─────────────────────────────────────────────────────
function fuseVectors(results: Array<{ valence: number; arousal: number; weight: number }>): EmotionVector {
  const totalWeight = results.reduce((s, r) => s + r.weight, 0);
  if (totalWeight === 0) return { valence: 0, arousal: 0.3, intensity: 0.3 };
  const valence = results.reduce((s, r) => s + r.valence * r.weight, 0) / totalWeight;
  const arousal  = results.reduce((s, r) => s + r.arousal  * r.weight, 0) / totalWeight;
  const intensity = Math.min(1, Math.abs(valence) * 0.5 + arousal * 0.5 + totalWeight * 0.1);
  return {
    valence:   Math.max(-1, Math.min(1, valence)),
    arousal:   Math.max(0,  Math.min(1, arousal)),
    intensity: Math.max(0,  Math.min(1, intensity)),
  };
}

export class EmotionEngine {
  processEmotion(input: EmotionProcessInput): EmotionProcessResult {
    const text = input.input.toLowerCase();

    // Layer 1: Surface emotion detection
    let layer1Emotion = 'neutral';
    let layer1Valence = 0;
    let layer1Arousal = 0.3;
    let maxHits = 0;

    const votingResults: Array<{ valence: number; arousal: number; weight: number }> = [];
    const emotionTags: string[] = [];

    for (const [emotion, pattern] of Object.entries(SURFACE_PATTERNS)) {
      const hits = pattern.kw.filter(kw => text.includes(kw.toLowerCase())).length;
      if (hits > 0) {
        votingResults.push({ valence: pattern.valence, arousal: pattern.arousal, weight: hits });
        emotionTags.push(emotion);
        if (hits > maxHits) {
          maxHits = hits;
          layer1Emotion = emotion;
          layer1Valence = pattern.valence;
          layer1Arousal = pattern.arousal;
        }
      }
    }

    // Apply emotionHint if provided
    if (input.emotionHint) {
      const hint = input.emotionHint;
      if (hint.valence !== undefined) layer1Valence = (layer1Valence + hint.valence) / 2;
      if (hint.arousal !== undefined) layer1Arousal = (hint.arousal + layer1Arousal) / 2;
    }

    // Layer 3: Social context adjustment
    let layer3Social = 'general';
    for (const [ctx, pattern] of Object.entries(SOCIAL_PATTERNS)) {
      const hits = pattern.kw.filter(kw => text.includes(kw.toLowerCase())).length;
      if (hits > 0) {
        layer3Social = ctx;
        votingResults.push({ valence: layer1Valence * 0.8, arousal: layer1Arousal + pattern.weight * 0.2, weight: pattern.weight });
      }
    }

    // Layer 5: Cognitive load
    const cogLoad = estimateCognitiveLoad(input.input);
    const layer5Cognitive = cogLoad > 0.6 ? 'high' : cogLoad > 0.3 ? 'medium' : 'low';

    // Layer 7: Fusion
    if (votingResults.length === 0) {
      votingResults.push({ valence: 0, arousal: 0.3, weight: 1 });
    }
    const fusedVector = fuseVectors(votingResults);

    // Confidence calculation
    const confidence = Math.min(0.95, 0.4 + maxHits * 0.15 + (emotionTags.length > 1 ? 0.1 : 0));

    // Processing mode
    let processingMode = 'basic';
    if (input.mode === 'advanced' || input.input.length > 200) processingMode = 'advanced';
    else if (input.mode === 'fusion' || emotionTags.length > 2) processingMode = 'fusion';
    else if (maxHits > 0) processingMode = 'basic';

    return {
      primaryEmotion: layer1Emotion,
      emotionVector: fusedVector,
      confidence,
      emotionTags: emotionTags.length > 0 ? emotionTags : ['neutral'],
      processingMode,
      layer1_surface: layer1Emotion,
      layer3_social: layer3Social,
      layer5_cognitive: layer5Cognitive,
    };
  }
}
