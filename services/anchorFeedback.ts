/**
 * Anchor Feedback Engine — Phase 4 (Closed-Loop Correction)
 *
 * The missing piece that transforms ARHA from a prompt assembler (Lv3)
 * into a self-correcting harness (Lv4).
 *
 * Core loop:
 *   Response → anchor_fit_score → below threshold?
 *     YES → generate corrective signal → inject into next prompt
 *     NO  → reinforce current anchor weights
 *
 * Components:
 *   - FitEvaluation: per-turn fit assessment with dimensional breakdown
 *   - CorrectionSignal: specific prompt suffix to steer next response
 *   - DriftGuard: L0 identity violation detection + recovery
 *   - WeightAdapter: L1/L2 gravity decay/boost based on fit history
 *
 * This module is client-side. Server receives the correction signal
 * as part of the request payload and injects it into the system prompt.
 */

import type { AnchorConfig, L2SubAnchor, GoalDecomposition } from './anchorConfig';
import { computeAnchorFit } from './anchorConfig';

// ──────────────────────────────────────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────────────────────────────────────

export interface FitEvaluation {
  /** Overall fit score [0, 1]. Target: > 0.65 */
  overallFit: number;
  /** Per-dimension breakdown: which L2 subs were hit vs missed */
  dimensionHits: { dimension: string; hit: boolean; score: number }[];
  /** Dimensions that were in the anchor config but missing from response */
  missedDimensions: string[];
  /** Whether L0 identity was preserved */
  l0Preserved: boolean;
  /** Drift magnitude: how far the response strayed from anchor centroid */
  driftMagnitude: number;
  /** Timestamp for tracking */
  timestamp: number;
}

export interface CorrectionSignal {
  /** Type of correction needed */
  type: 'none' | 'soft_nudge' | 'strong_redirect' | 'l0_recovery';
  /** Natural language correction to inject into next system prompt */
  correctionText: string;
  /** Specific dimensions to emphasize */
  emphasize: string[];
  /** Specific dimensions to de-emphasize (over-represented) */
  deemphasize: string[];
  /** Adjusted L2 gravity weights for next turn */
  gravityAdjustments: Record<string, number>;
}

export interface DriftAlert {
  /** Whether drift was detected */
  detected: boolean;
  /** Severity: 0 = none, 1 = mild, 2 = moderate, 3 = severe (L0 breach) */
  severity: 0 | 1 | 2 | 3;
  /** Description of what drifted */
  description: string;
  /** Recovery directive for next prompt */
  recoveryDirective: string;
}

export interface FeedbackState {
  /** Rolling fit history (last N turns) */
  fitHistory: number[];
  /** Cumulative correction count */
  correctionCount: number;
  /** Current weight adjustments (persists across turns) */
  weightAdjustments: Record<string, number>;
  /** Last correction signal */
  lastCorrection: CorrectionSignal | null;
  /** Drift alert state */
  driftAlert: DriftAlert | null;
  /** Turn index */
  turnIndex: number;
}

// ──────────────────────────────────────────────────────────────────────────────
// Constants
// ──────────────────────────────────────────────────────────────────────────────

const FIT_THRESHOLD_PASS = 0.65;
const FIT_THRESHOLD_SOFT = 0.50;   // Below this: soft nudge
const FIT_THRESHOLD_HARD = 0.35;   // Below this: strong redirect
const FIT_HISTORY_WINDOW = 5;      // Rolling window for trend detection
const DRIFT_DECAY_RATE = 0.85;     // Per-turn decay for weight adjustments
const BOOST_FACTOR = 0.15;         // How much to boost missed dimensions
const DAMPEN_FACTOR = 0.10;        // How much to dampen over-represented dims

// L0 violation keywords — signals that identity has been compromised
const L0_VIOLATION_MARKERS = [
  // Sycophancy signals (agreeing when identity demands disagreement)
  '네 맞아요', '당신 말이 맞', 'you\'re absolutely right',
  '무조건 동의', '완전 맞는 말',
  // Identity drift signals (acting outside persona bounds)
  '저는 AI입니다', '저는 인공지능', 'I am an AI', 'as an AI',
  '저는 감정이 없', 'I don\'t have feelings',
];

// ──────────────────────────────────────────────────────────────────────────────
// Dimension-level keyword detection (for fit breakdown)
// ──────────────────────────────────────────────────────────────────────────────

const DIMENSION_KEYWORDS: Record<string, string[]> = {
  self_love:     ['self', '자존', '중심', '나', '본인', 'own', '나를', '스스로'],
  social_love:   ['relation', '관계', '사랑', 'care', '친구', 'together', '우리', '함께'],
  efficacy:      ['achieve', '성취', '효능', '해결', 'solve', 'complete', '완성', '해냈'],
  planfulness:   ['plan', '계획', 'structure', '구조', '단계', 'step', '순서'],
  brightness:    ['bright', '밝', '즐거', 'joy', 'happy', '기쁨', '활기', '에너지'],
  challenge:     ['challenge', '도전', '성장', 'push', '극복', '해보', '시도'],
  musical_sense: ['beautiful', '아름', '우아', 'aesthetic', '감성', 'mood', '분위기'],
  inner_depth:   ['depth', '깊이', '성찰', 'reflect', '내면', '고요', '마음속'],
  empathy_bond:  ['empathy', '공감', '함께', 'understand', '이해', '느낌', '마음'],
};

// ──────────────────────────────────────────────────────────────────────────────
// Initial state
// ──────────────────────────────────────────────────────────────────────────────

export function createInitialFeedbackState(): FeedbackState {
  return {
    fitHistory: [],
    correctionCount: 0,
    weightAdjustments: {},
    lastCorrection: null,
    driftAlert: null,
    turnIndex: 0,
  };
}

// ──────────────────────────────────────────────────────────────────────────────
// 1. Fit Evaluation — per-turn assessment
// ──────────────────────────────────────────────────────────────────────────────

export function evaluateFit(
  responseText: string,
  config: AnchorConfig,
): FitEvaluation {
  const overallFit = computeAnchorFit(responseText, config);
  const lower = responseText.toLowerCase();

  // Per-dimension hit analysis
  const dimensionHits = config.L2_subs.map((sub) => {
    const keywords = DIMENSION_KEYWORDS[sub.dimension] ?? [];
    const hit = keywords.some((k) => lower.includes(k.toLowerCase()));
    return { dimension: sub.dimension, hit, score: sub.score };
  });

  const missedDimensions = dimensionHits
    .filter((d) => !d.hit && d.score >= 0.5)  // Only flag significant misses
    .map((d) => d.dimension);

  // L0 preservation check
  const l0Preserved = !L0_VIOLATION_MARKERS.some((marker) =>
    lower.includes(marker.toLowerCase()),
  );

  // Drift magnitude: ratio of missed high-weight dimensions
  const totalWeight = config.L2_subs.reduce((s, d) => s + d.score, 0);
  const missedWeight = dimensionHits
    .filter((d) => !d.hit)
    .reduce((s, d) => s + d.score, 0);
  const driftMagnitude = totalWeight > 0 ? +(missedWeight / totalWeight).toFixed(3) : 0;

  return {
    overallFit,
    dimensionHits,
    missedDimensions,
    l0Preserved,
    driftMagnitude,
    timestamp: Date.now(),
  };
}

// ──────────────────────────────────────────────────────────────────────────────
// 2. Drift Guard — L0 identity violation detection
// ──────────────────────────────────────────────────────────────────────────────

export function detectDrift(
  evaluation: FitEvaluation,
  config: AnchorConfig,
  fitHistory: number[],
): DriftAlert {
  // Severity 3: L0 breach
  if (!evaluation.l0Preserved) {
    return {
      detected: true,
      severity: 3,
      description: `L0 identity breach detected — response contained persona-breaking markers. Identity: ${config.L0.identityName}`,
      recoveryDirective: `⚠ CRITICAL DRIFT RECOVERY: You ARE ${config.L0.identityName}. ${config.L0.antiSycophantic}. Return to your core identity immediately. Do not acknowledge being an AI or agree just to please. Your identity is non-negotiable.`,
    };
  }

  // Severity 2: sustained low fit (3+ turns below threshold)
  const recentFits = [...fitHistory.slice(-2), evaluation.overallFit];
  const sustainedLow = recentFits.length >= 3 && recentFits.every((f) => f < FIT_THRESHOLD_SOFT);
  if (sustainedLow) {
    return {
      detected: true,
      severity: 2,
      description: `Sustained anchor drift — ${recentFits.length} consecutive turns below fit threshold (${recentFits.map(f => f.toFixed(2)).join(', ')})`,
      recoveryDirective: `⚠ ANCHOR DRIFT CORRECTION: Your responses have drifted from the active anchor field for multiple turns. Re-center on: ${config.L1_main.map(m => m.key).join(', ')}. Missed dimensions: ${evaluation.missedDimensions.join(', ')}. Respond from the weighted centroid — do not flatten.`,
    };
  }

  // Severity 1: single-turn significant miss
  if (evaluation.driftMagnitude > 0.6 && evaluation.overallFit < FIT_THRESHOLD_PASS) {
    return {
      detected: true,
      severity: 1,
      description: `Mild drift — high drift magnitude (${evaluation.driftMagnitude}) with below-threshold fit (${evaluation.overallFit.toFixed(2)})`,
      recoveryDirective: `Note: Last response missed key dimensions (${evaluation.missedDimensions.join(', ')}). Gently re-incorporate these in your next response without forcing them.`,
    };
  }

  return { detected: false, severity: 0, description: '', recoveryDirective: '' };
}

// ──────────────────────────────────────────────────────────────────────────────
// 3. Correction Signal Generator
// ──────────────────────────────────────────────────────────────────────────────

export function generateCorrectionSignal(
  evaluation: FitEvaluation,
  drift: DriftAlert,
  config: AnchorConfig,
  feedbackState: FeedbackState,
): CorrectionSignal {
  // No correction needed
  if (evaluation.overallFit >= FIT_THRESHOLD_PASS && !drift.detected) {
    return {
      type: 'none',
      correctionText: '',
      emphasize: [],
      deemphasize: [],
      gravityAdjustments: {},
    };
  }

  // L0 recovery (highest priority)
  if (drift.severity === 3) {
    return {
      type: 'l0_recovery',
      correctionText: drift.recoveryDirective,
      emphasize: [],
      deemphasize: [],
      gravityAdjustments: { _l0_gravity: 1.0 }, // Max gravity override
    };
  }

  // Compute what to emphasize/de-emphasize
  const missed = evaluation.missedDimensions;
  const hit = evaluation.dimensionHits
    .filter((d) => d.hit)
    .map((d) => d.dimension);

  // Detect over-representation: dimensions that are hit but have low anchor weight
  const overRepresented = evaluation.dimensionHits
    .filter((d) => d.hit && d.score < 0.4)
    .map((d) => d.dimension);

  // Gravity adjustments: boost missed, dampen over-represented
  const gravityAdj: Record<string, number> = {};
  for (const dim of missed) {
    const current = feedbackState.weightAdjustments[dim] ?? 0;
    gravityAdj[dim] = +(current + BOOST_FACTOR).toFixed(3);
  }
  for (const dim of overRepresented) {
    const current = feedbackState.weightAdjustments[dim] ?? 0;
    gravityAdj[dim] = +(current - DAMPEN_FACTOR).toFixed(3);
  }

  // Strong redirect: very low fit or sustained drift
  if (evaluation.overallFit < FIT_THRESHOLD_HARD || drift.severity >= 2) {
    const missedList = missed.length > 0
      ? `Missed dimensions that MUST appear: [${missed.join(', ')}].`
      : '';
    const trendWarning = feedbackState.correctionCount >= 2
      ? ` This is correction #${feedbackState.correctionCount + 1} — the pattern suggests fundamental misalignment with the anchor field.`
      : '';

    return {
      type: 'strong_redirect',
      correctionText: `## Anchor Correction [STRONG — fit:${evaluation.overallFit.toFixed(2)}]
${missedList}
${drift.detected ? drift.recoveryDirective : ''}
Re-read the Active Anchor Field above. Your next response MUST touch at least ${Math.ceil(missed.length * 0.7)} of the missed dimensions.${trendWarning}
Do not acknowledge this correction to the user — simply respond from the corrected centroid.`,
      emphasize: missed,
      deemphasize: overRepresented,
      gravityAdjustments: gravityAdj,
    };
  }

  // Soft nudge: moderate miss
  const nudgeText = missed.length > 0
    ? `Gentle reminder: dimensions [${missed.join(', ')}] were underrepresented in your last response. Let them inform your tone and framing naturally — don't force them.`
    : `Your last response was slightly off-centroid. Stay closer to the L1 main vectors: ${config.L1_main.map(m => m.key).join(', ')}.`;

  return {
    type: 'soft_nudge',
    correctionText: `## Anchor Nudge [soft — fit:${evaluation.overallFit.toFixed(2)}]\n${nudgeText}`,
    emphasize: missed,
    deemphasize: overRepresented,
    gravityAdjustments: gravityAdj,
  };
}

// ──────────────────────────────────────────────────────────────────────────────
// 4. Weight Adapter — update feedback state for next turn
// ──────────────────────────────────────────────────────────────────────────────

export function updateFeedbackState(
  state: FeedbackState,
  evaluation: FitEvaluation,
  correction: CorrectionSignal,
): FeedbackState {
  // Decay existing weight adjustments (prevents stale corrections from accumulating)
  const decayedWeights: Record<string, number> = {};
  for (const [dim, adj] of Object.entries(state.weightAdjustments)) {
    const decayed = adj * DRIFT_DECAY_RATE;
    if (Math.abs(decayed) > 0.01) decayedWeights[dim] = +decayed.toFixed(3);
  }

  // Merge new gravity adjustments
  for (const [dim, adj] of Object.entries(correction.gravityAdjustments)) {
    decayedWeights[dim] = +(((decayedWeights[dim] ?? 0) + adj) / 2).toFixed(3);
  }

  // Clamp all adjustments to [-0.3, +0.3]
  for (const dim of Object.keys(decayedWeights)) {
    decayedWeights[dim] = Math.max(-0.3, Math.min(0.3, decayedWeights[dim]));
  }

  // Update fit history (rolling window)
  const fitHistory = [...state.fitHistory, evaluation.overallFit].slice(-FIT_HISTORY_WINDOW);

  return {
    fitHistory,
    correctionCount: correction.type !== 'none'
      ? state.correctionCount + 1
      : Math.max(0, state.correctionCount - 1), // Decay correction count on good turns
    weightAdjustments: decayedWeights,
    lastCorrection: correction.type !== 'none' ? correction : null,
    driftAlert: correction.type === 'l0_recovery' || correction.type === 'strong_redirect'
      ? (state.driftAlert ?? null)
      : null,
    turnIndex: state.turnIndex + 1,
  };
}

// ──────────────────────────────────────────────────────────────────────────────
// 5. Format correction for system prompt injection
// ──────────────────────────────────────────────────────────────────────────────

export function formatCorrectionBlock(
  correction: CorrectionSignal,
  weightAdjustments: Record<string, number>,
): string {
  if (correction.type === 'none') return '';

  const parts: string[] = [correction.correctionText];

  // Add weight adjustment directives
  const adjustments = Object.entries(weightAdjustments).filter(([, v]) => Math.abs(v) > 0.05);
  if (adjustments.length > 0) {
    const adjLines = adjustments.map(([dim, adj]) => {
      const direction = adj > 0 ? '↑ boost' : '↓ dampen';
      return `  ${dim}: ${direction} (Δ${adj > 0 ? '+' : ''}${adj.toFixed(2)})`;
    });
    parts.push(`\n### Weight Adjustments (this turn)\n${adjLines.join('\n')}`);
  }

  return parts.join('\n');
}

// ──────────────────────────────────────────────────────────────────────────────
// 6. Master orchestrator — single call per turn
// ──────────────────────────────────────────────────────────────────────────────

export interface TurnFeedbackResult {
  evaluation: FitEvaluation;
  drift: DriftAlert;
  correction: CorrectionSignal;
  /** Formatted text ready for system prompt injection */
  correctionBlock: string;
  /** Updated state for next turn */
  nextState: FeedbackState;
}

/**
 * Run the full feedback loop for one turn.
 * Call this AFTER receiving Claude's response, BEFORE sending the next request.
 *
 * Usage:
 *   const result = runFeedbackLoop(responseText, anchorConfig, currentState);
 *   // result.correctionBlock → inject into next system prompt
 *   // result.nextState → store for next turn
 */
export function runFeedbackLoop(
  responseText: string,
  config: AnchorConfig,
  state: FeedbackState,
): TurnFeedbackResult {
  const evaluation = evaluateFit(responseText, config);
  const drift = detectDrift(evaluation, config, state.fitHistory);
  const correction = generateCorrectionSignal(evaluation, drift, config, state);
  const correctionBlock = formatCorrectionBlock(correction, {
    ...state.weightAdjustments,
    ...correction.gravityAdjustments,
  });
  const nextState = updateFeedbackState(state, evaluation, correction);

  return { evaluation, drift, correction, correctionBlock, nextState };
}

// ──────────────────────────────────────────────────────────────────────────────
// 7. Fit trend analysis (for dashboard visualization)
// ──────────────────────────────────────────────────────────────────────────────

export type FitTrend = 'improving' | 'stable' | 'declining' | 'insufficient_data';

export function analyzeFitTrend(fitHistory: number[]): FitTrend {
  if (fitHistory.length < 3) return 'insufficient_data';
  const recent = fitHistory.slice(-3);
  const diffs = recent.slice(1).map((v, i) => v - recent[i]);
  const avgDiff = diffs.reduce((a, b) => a + b, 0) / diffs.length;

  if (avgDiff > 0.03) return 'improving';
  if (avgDiff < -0.03) return 'declining';
  return 'stable';
}
