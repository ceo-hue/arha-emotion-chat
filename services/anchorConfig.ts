/**
 * Anchor Config — v3.1 Production (per Doc 10)
 *
 * Implements:
 *   - Δ_GoalDecompose (heuristic version for Phase 1, no LLM call)
 *   - complexity_score (per Doc 10 §3.1)
 *   - buildAnchorConfig (L0/L1/L2 hierarchy construction)
 *   - buildAnchorPromptBlock (Τ_PromptAnchor — system prompt injection format)
 *   - anchor_fit_score (per Doc 10 §3.2, Phase 1 keyword-based approximation)
 *
 * Phase 2 will replace heuristicDecompose with embedding-based LLM structured output.
 * This module is the CLIENT-SIDE mirror — server has its own JS implementation
 * in api/chat.js and server.js (same logic, duplicated per project convention).
 */

import type { ValueChainItem } from '../types';
import { getL0CoreAnchor, computeTriVector, type L0CoreAnchor, type TriVectorField } from './personaRegistry';

// ──────────────────────────────────────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────────────────────────────────────

export type AnchorMode = 'triangle' | 'square' | 'pentagon' | 'equation';

export type L1VectorKey = 'V_Agency' | 'V_Morning' | 'V_Musical';

export interface L1MainAnchor {
  key: L1VectorKey;
  score: number;          // 0~1 average of its 3 dimensions
  dimensions: string;     // pretty label of dimensions
}

export interface L2SubAnchor {
  dimension: string;                           // e.g. 'self_love'
  vector: 'agency' | 'morning' | 'musical';
  score: number;                               // 0~1
}

export interface GoalDecomposition {
  sub_goal_count: number;
  domains: string[];
  complexity: number;
  length_factor: number;
}

export interface AnchorConfig {
  personaId: string;
  mode: AnchorMode;
  complexity: number;
  decomposition: GoalDecomposition;
  L0: L0CoreAnchor;
  L1_main: L1MainAnchor[];       // 1~3 vectors
  L2_subs: L2SubAnchor[];        // 2~5 dimensions
  triVector: TriVectorField;
}

// ──────────────────────────────────────────────────────────────────────────────
// Δ_GoalDecompose (heuristic Phase 1 version — no LLM call)
// Operational definition per Doc 10 §3.1
// ──────────────────────────────────────────────────────────────────────────────

const DOMAIN_KEYWORDS: Record<string, string[]> = {
  design:   ['디자인', '페이지', 'landing', '색', '배치', '타이포', '레이아웃', 'ui', 'ux', '이미지', 'css'],
  code:     ['코드', '함수', 'python', 'javascript', 'typescript', '버그', '구현', 'api', '에러', 'error', '디버'],
  emotion:  ['힘들', '기뻐', '슬퍼', '괜찮', '느낌', '마음', '감정', '외로', '위로', '행복'],
  logic:    ['분석', '설명', '왜', '이유', '근거', '논리', '비교', '평가', '판단'],
  creative: ['만들어', '작성', '써줘', '생성', '창작', '아이디어', '브레인스토', '영감'],
  research: ['조사', '찾아', '검색', '알려줘', '정보', '자료', '문서', '논문'],
};

const SUBGOAL_MARKERS = ['그리고', ' 또 ', ',', '+', '하고', ' 및 ', '&', '그다음', '그 다음'];

/**
 * Heuristic goal decomposition — Phase 1 (no LLM call).
 * Will be upgraded to structured Claude call in Phase 2.
 */
export function heuristicDecompose(goal: string): GoalDecomposition {
  const lower = goal.toLowerCase();

  // Domain detection
  const domains: string[] = [];
  for (const [domain, keywords] of Object.entries(DOMAIN_KEYWORDS)) {
    if (keywords.some((k) => lower.includes(k))) {
      domains.push(domain);
    }
  }

  // Sub-goal count via conjunction markers
  let clauseCount = 0;
  for (const marker of SUBGOAL_MARKERS) {
    clauseCount += Math.max(0, goal.split(marker).length - 1);
  }
  // Question marks also indicate distinct asks
  clauseCount += Math.max(0, (goal.match(/[?？]/g) || []).length - 1);
  const sub_goal_count = Math.min(clauseCount + 1, 6);

  // Length factor
  const length_factor = Math.min(goal.length / 200, 1.0);

  // Complexity per Doc 10 §3.1
  const complexity = Math.min(
    0.4 * (sub_goal_count / 5) +
    0.4 * (Math.min(domains.length, 3) / 3) +
    0.2 * length_factor,
    1.0,
  );

  return {
    sub_goal_count,
    domains,
    complexity: +complexity.toFixed(3),
    length_factor: +length_factor.toFixed(3),
  };
}

// ──────────────────────────────────────────────────────────────────────────────
// Anchor Mode Selection (per Doc 08 §Ω_AnchorSelect)
// ──────────────────────────────────────────────────────────────────────────────

export function pickAnchorMode(complexity: number): AnchorMode {
  if (complexity < 0.4) return 'triangle';
  if (complexity < 0.7) return 'square';
  if (complexity < 0.9) return 'pentagon';
  return 'equation';
}

export function maxSubsForMode(mode: AnchorMode): number {
  switch (mode) {
    case 'triangle': return 2;
    case 'square':   return 3;
    case 'pentagon': return 4;
    case 'equation': return 5;
  }
}

// ──────────────────────────────────────────────────────────────────────────────
// AnchorConfig Builder
// ──────────────────────────────────────────────────────────────────────────────

const V_DIMENSIONS_LABEL: Record<L1VectorKey, string> = {
  V_Agency:  'self_love | social_love | efficacy',
  V_Morning: 'planfulness | brightness | challenge',
  V_Musical: 'musical_sense | inner_depth | empathy_bond',
};

// fx key → primary L1 vectors that contribute to it
const FX_TO_L1: Record<string, L1VectorKey[]> = {
  achievement: ['V_Agency', 'V_Morning'],
  grounded:    ['V_Agency', 'V_Musical'],
  relational:  ['V_Agency', 'V_Musical'],
  expressive:  ['V_Morning', 'V_Musical'],
  structured:  ['V_Morning', 'V_Agency'],
};

function vectorAverage(v: object): number {
  const vals = Object.values(v as Record<string, number>);
  return vals.reduce((a, b) => a + b, 0) / Math.max(vals.length, 1);
}

export function buildAnchorConfig(
  personaId: string,
  valueChain: ValueChainItem[],
  goal: string,
): AnchorConfig {
  const decomposition = heuristicDecompose(goal);
  const mode = pickAnchorMode(decomposition.complexity);
  const L0 = getL0CoreAnchor(personaId);
  const triVector = computeTriVector(valueChain);

  // Pick L1 main vectors based on dominant fx
  const fxSorted = Object.entries(triVector.fx).sort((a, b) => b[1] - a[1]);
  const primaryFxKey = fxSorted[0][0];
  const primaryL1Keys = FX_TO_L1[primaryFxKey] ?? ['V_Agency'];

  // For high complexity, allow secondary fx to contribute another L1
  const L1KeySet = new Set<L1VectorKey>(primaryL1Keys);
  if (decomposition.complexity >= 0.7 && fxSorted.length > 1) {
    const secondaryL1 = FX_TO_L1[fxSorted[1][0]] ?? [];
    secondaryL1.forEach((k) => L1KeySet.add(k));
  }
  // Clamp to max 3 L1 mains
  const L1Keys = Array.from(L1KeySet).slice(0, 3);

  const L1_main: L1MainAnchor[] = L1Keys.map((key) => {
    const vec = key === 'V_Agency'  ? triVector.agency
              : key === 'V_Morning' ? triVector.morning
              : triVector.musical;
    return {
      key,
      score: +vectorAverage(vec).toFixed(2),
      dimensions: V_DIMENSIONS_LABEL[key],
    };
  });

  // L2 subs: top dimensions overall, capped by mode
  const allDimensions: L2SubAnchor[] = [
    ...Object.entries(triVector.agency).map(([k, v]) => ({ dimension: k, vector: 'agency' as const, score: v })),
    ...Object.entries(triVector.morning).map(([k, v]) => ({ dimension: k, vector: 'morning' as const, score: v })),
    ...Object.entries(triVector.musical).map(([k, v]) => ({ dimension: k, vector: 'musical' as const, score: v })),
  ];
  const cap = maxSubsForMode(mode);
  const L2_subs = allDimensions
    .sort((a, b) => b.score - a.score)
    .slice(0, cap);

  return {
    personaId,
    mode,
    complexity: decomposition.complexity,
    decomposition,
    L0,
    L1_main,
    L2_subs,
    triVector,
  };
}

// ──────────────────────────────────────────────────────────────────────────────
// Τ_PromptAnchor — format AnchorConfig as system prompt section
// (Doc 10 §5.1)
// ──────────────────────────────────────────────────────────────────────────────

export function buildAnchorPromptBlock(config: AnchorConfig): string {
  const { L0, L1_main, L2_subs, triVector, mode, complexity } = config;

  const L1Lines = L1_main.map(
    (m) => `  - ${m.key}(${m.score.toFixed(2)}) :: ${m.dimensions}`,
  ).join('\n');

  const L2Lines = L2_subs.map(
    (s) => `  - ${s.dimension}(${s.score.toFixed(2)}) [${s.vector}]`,
  ).join('\n');

  const { dominant } = triVector;
  const pullLabel = getPullLabel(dominant.key);

  return `## Active Anchor Field [mode:${mode} · complexity:${complexity.toFixed(2)}]

### L0 [locked · gravity:1.0]
${L0.identityName} — ${L0.hierarchyNotation}
Anti-Sycophantic: ${L0.antiSycophantic}
Drift tolerance: ${L0.driftTolerance.toFixed(2)}

### L1 Main [session · gravity:0.90]
${L1Lines}

### L2 Sub [task · gravity:0.75]
${L2Lines}

### Cross-Vector Pull
Dominant: ${dominant.key}(${dominant.score.toFixed(2)}) — ${pullLabel}

### Response Directive
Respond from the weighted centroid of L1 × L2 dimensions.
Honor the dominant pull without flattening the secondary dimensions.
Never drift beyond L0 tolerance — L0 is immutable within this session.`;
}

function getPullLabel(key: string): string {
  const labels: Record<string, string> = {
    achievement: 'ground in concrete steps and forward momentum',
    grounded:    'touch your own depth first, then extend outward',
    relational:  'center the response on connection and attunement',
    expressive:  'open brightly through sensory and musical registers',
    structured:  'move forward within a clear, organized frame',
  };
  return labels[key] ?? 'respond from the centroid';
}

// ──────────────────────────────────────────────────────────────────────────────
// anchor_fit_score (Phase 1 keyword-based approximation)
// Operational definition per Doc 10 §3.2
// ──────────────────────────────────────────────────────────────────────────────

const DIMENSION_KEYWORDS: Record<string, string[]> = {
  self_love:     ['self', '자존', '중심', '나', '본인', 'own'],
  social_love:   ['relation', '관계', '사랑', 'care', '친구', 'together', '우리'],
  efficacy:      ['achieve', '성취', '효능', '해결', 'solve', 'complete', '완성'],
  planfulness:   ['plan', '계획', 'structure', '구조', '단계', 'step'],
  brightness:    ['bright', '밝', '즐거', 'joy', 'happy', '기쁨', '활기'],
  challenge:     ['challenge', '도전', '성장', 'push', '극복', '해보'],
  musical_sense: ['beautiful', '아름', '우아', 'aesthetic', '감성', 'mood'],
  inner_depth:   ['depth', '깊이', '성찰', 'reflect', '내면', '고요'],
  empathy_bond:  ['empathy', '공감', '함께', 'understand', '이해', '느낌'],
};

/**
 * Compute anchor fit score from response text and anchor config.
 * Phase 1: keyword-based approximation (no embedding).
 * Returns [0, 1]. Threshold for pass: > 0.65 per Doc 10 §3.2.
 */
export function computeAnchorFit(responseText: string, config: AnchorConfig): number {
  if (!responseText || !responseText.trim()) return 0;
  const lower = responseText.toLowerCase();

  // For each L2 sub, check if any of its keywords appear in response
  const scores: number[] = [];
  for (const sub of config.L2_subs) {
    const keywords = DIMENSION_KEYWORDS[sub.dimension] ?? [];
    const hits = keywords.filter((k) => lower.includes(k.toLowerCase())).length;
    // Coverage: did this dimension leave a footprint?
    const coverage = hits > 0 ? Math.min(1, 0.5 + hits * 0.2) : 0;
    // Weight by anchor score
    scores.push(coverage * sub.score);
  }

  // Normalize by max possible score
  const maxPossible = config.L2_subs.reduce((sum, s) => sum + s.score, 0);
  if (maxPossible === 0) return 0;
  const rawFit = scores.reduce((a, b) => a + b, 0) / maxPossible;

  // Base fit 0.4 (every coherent response has some minimum fit)
  // Phase 1 calibration: lift so that typical good responses land > 0.65
  const fit = 0.4 + rawFit * 0.6;
  return +Math.min(1, Math.max(0, fit)).toFixed(3);
}
