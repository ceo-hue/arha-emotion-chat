// ═══════════════════════════════════════════════════════════
//  Narration Service — Claude 기반 영상 스크립트 생성
//  /api/narration → { consistencyAnchor, shots[] }
//  함수언어체계 브릿지: expressionMode + trajectory 전달 → 톤/아크/비주얼 이식
// ═══════════════════════════════════════════════════════════

import { EXPRESSION_VISUAL_MAP } from '../lib/promptPipeline'

export type NarrationShot = {
  readonly index:        number;
  narration:             string; // Korean voiceover — user-editable
  visualPrompt:          string; // English visual description — user-editable
  readonly duration:     number; // seconds
};

export type NarrationScript = {
  readonly concept:           string;
  readonly type:              'ad' | 'movie';
  readonly consistencyAnchor: string;
  readonly expressionMode?:   string; // 생성 시 사용된 expressionMode — visual prompt에 재주입
  shots:                      NarrationShot[];
};

export type NarrationRequest = {
  concept:        string;
  type:           'ad' | 'movie';
  shotCount:      number;
  // 함수언어체계 브릿지 — 채팅 currentAnalysis에서 전달
  expressionMode?: string;
  trajectory?:    string;
};

/**
 * generateNarrationScript — calls /api/narration and returns structured script
 * Claude produces: consistencyAnchor + shots[]
 */
export const generateNarrationScript = async (req: NarrationRequest): Promise<NarrationScript> => {
  const response = await fetch('/api/narration', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(req),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({})) as { error?: string };
    throw new Error(err.error ?? `Narration API error: ${response.status}`);
  }

  const data = await response.json() as { consistencyAnchor: string; shots: NarrationShot[] };
  return {
    concept:           req.concept,
    type:              req.type,
    consistencyAnchor: data.consistencyAnchor,
    expressionMode:    req.expressionMode,
    shots:             data.shots,
  };
};

/**
 * buildSeriesVideoPrompt — injects consistencyAnchor + expressionMode visual grammar
 * Layer B 브릿지: 채팅 expressionMode → 카메라 문법 → VEO 프롬프트
 * 순서: shot.visualPrompt → consistencyAnchor → EXPRESSION_VISUAL_MAP[mode]
 */
export const buildSeriesVideoPrompt = (
  shot: NarrationShot,
  anchor: string,
  expressionMode?: string,
): string => {
  const visualGrammar = expressionMode ? (EXPRESSION_VISUAL_MAP[expressionMode] ?? '') : '';
  const parts = [shot.visualPrompt.trim(), anchor, visualGrammar].filter(Boolean);
  return parts.join(', ');
};
