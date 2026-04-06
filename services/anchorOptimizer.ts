/**
 * Anchor Optimizer — Phase 6 (Self-Optimizing Harness)
 *
 * The final piece that transitions ARHA from a self-correcting harness (Lv4)
 * to a self-optimizing system (Lv5).
 *
 * Core capabilities:
 *   1. Weight Adapter   — adjusts L2 sub scores using learned dimension affinities
 *   2. Gravity Scaler   — modulates anchor assertiveness per user trust level
 *   3. Mode Selector    — overrides complexity-based mode with persona-learned best mode
 *   4. Threshold Tuner  — adapts fit/drift thresholds to user's historical distribution
 *   5. Optimization Log — tracks what changed and why (explainability)
 *
 * This module is stateless — it reads from UserAnchorProfile + AnchorPersonalization
 * and produces an OptimizationResult that modifies anchor config + feedback params.
 */

import type { AnchorConfig, AnchorMode, L2SubAnchor } from './anchorConfig';
import type { AnchorPersonalization, UserAnchorProfile } from './userAnchorProfile';

// ───────────────────────────────���──────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────���

export interface OptimizedThresholds {
  /** Adapted pass threshold (default 0.65) */
  fitPass: number;
  /** Adapted soft nudge threshold (default 0.50) */
  fitSoft: number;
  /** Adapted hard redirect threshold (default 0.35) */
  fitHard: number;
}

export interface OptimizationLogEntry {
  /** What was changed */
  target: string;
  /** From value */
  from: string;
  /** To value */
  to: string;
  /** Why it was changed */
  reason: string;
}

export interface OptimizationResult {
  /** Whether optimization was applied (false = insufficient data) */
  applied: boolean;
  /** Optimized L2 sub weights */
  optimizedSubs: L2SubAnchor[];
  /** Gravity multiplier to apply to anchor prompt */
  gravity: number;
  /** Suggested anchor mode (null = keep default) */
  suggestedMode: AnchorMode | null;
  /** Adapted fit thresholds */
  thresholds: OptimizedThresholds;
  /** Human-readable optimization log */
  log: OptimizationLogEntry[];
  /** Compact summary for system prompt injection */
  optimizationDirective: string;
}

// ────────────────────────────────────────────────────────────���─────────────────
// Constants
// ──────────────────────────────────────────────���───────────────────────────────

const DEFAULT_FIT_PASS = 0.65;
const DEFAULT_FIT_SOFT = 0.50;
const DEFAULT_FIT_HARD = 0.35;

/** Max weight adjustment from personalization (±15% of original) */
const MAX_WEIGHT_DELTA = 0.15;

/** Threshold adaptation range (±0.08 from default) */
const THRESHOLD_ADAPT_RANGE = 0.08;

/** Minimum correction rate to trigger threshold relaxation */
const HIGH_CORRECTION_RATE = 0.3;

/** Maximum correction rate before tightening thresholds */
const LOW_CORRECTION_RATE = 0.05;

// ──────────────────────────────────────────────────────────────────────────────
// Main optimizer
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Apply self-optimization to an anchor config based on learned user profile.
 *
 * Call this AFTER buildAnchorConfig but BEFORE prompt assembly.
 * The result provides adjusted weights, gravity, mode, and thresholds.
 */
export function optimizeAnchorConfig(
  config: AnchorConfig,
  personalization: AnchorPersonalization | null,
  profile: UserAnchorProfile | null,
): OptimizationResult {
  const log: OptimizationLogEntry[] = [];

  // No optimization without reliable personalization
  if (!personalization?.reliable || !profile) {
    return {
      applied: false,
      optimizedSubs: config.L2_subs,
      gravity: 1.0,
      suggestedMode: null,
      thresholds: { fitPass: DEFAULT_FIT_PASS, fitSoft: DEFAULT_FIT_SOFT, fitHard: DEFAULT_FIT_HARD },
      log: [],
      optimizationDirective: '',
    };
  }

  // ── 1. Weight Adapter: adjust L2 sub scores ─────────────────────────────
  const optimizedSubs = config.L2_subs.map((sub) => {
    const dimWeight = personalization.dimensionWeights[sub.dimension] ?? 0;
    if (Math.abs(dimWeight) < 0.01) return sub;

    const delta = clamp(dimWeight, -MAX_WEIGHT_DELTA, MAX_WEIGHT_DELTA);
    const newScore = clamp(sub.score + delta, 0.1, 1.0);
    const rounded = +newScore.toFixed(3);

    if (rounded !== sub.score) {
      log.push({
        target: `L2.${sub.dimension}`,
        from: sub.score.toFixed(3),
        to: rounded.toFixed(3),
        reason: `dim affinity Δ${dimWeight > 0 ? '+' : ''}${dimWeight.toFixed(3)}`,
      });
    }

    return { ...sub, score: rounded };
  });

  // Re-sort by score (optimization may change ranking)
  optimizedSubs.sort((a, b) => b.score - a.score);

  // ── 2. Gravity Scaler ───────────────────────────────────────────────────
  const gravity = personalization.gravityMultiplier;
  if (Math.abs(gravity - 1.0) > 0.01) {
    log.push({
      target: 'gravity',
      from: '1.00',
      to: gravity.toFixed(2),
      reason: `κ-learned trust level (${profile.totalSessions} sessions)`,
    });
  }

  // ── 3. Mode Selector ───────────────────��───────────────────────────────
  const suggestedMode = personalization.suggestedMode;
  if (suggestedMode && suggestedMode !== config.mode) {
    log.push({
      target: 'mode',
      from: config.mode,
      to: suggestedMode,
      reason: `persona best-mode from ${profile.personaStats[config.personaId]?.sessionCount ?? 0} sessions`,
    });
  }

  // ── 4. Threshold Tuner ──────────────────────────────────────────────────
  const thresholds = computeAdaptiveThresholds(profile, config.personaId);
  if (thresholds.fitPass !== DEFAULT_FIT_PASS) {
    log.push({
      target: 'threshold.fitPass',
      from: DEFAULT_FIT_PASS.toFixed(2),
      to: thresholds.fitPass.toFixed(2),
      reason: thresholds.fitPass < DEFAULT_FIT_PASS
        ? 'high correction rate → relaxed threshold'
        : 'low correction rate → tightened threshold',
    });
  }

  // ── 5. Build optimization directive ─────────────────────────────────────
  const optimizationDirective = buildOptimizationDirective(log, gravity, profile.totalSessions);

  return {
    applied: true,
    optimizedSubs,
    gravity,
    suggestedMode,
    thresholds,
    log,
    optimizationDirective,
  };
}

// ─────────────────────────���──────────────────────────��─────────────────────────
// Adaptive Threshold Computation
// ──────────────────────────────────────��──────────────────────────────��────────

/**
 * Adapt fit thresholds based on user's correction history.
 *
 * If correction rate is high → user may have a naturally different style,
 * relax thresholds to avoid over-correcting.
 *
 * If correction rate is very low → thresholds can be tightened for
 * higher quality anchoring.
 */
function computeAdaptiveThresholds(
  profile: UserAnchorProfile,
  personaId: string,
): OptimizedThresholds {
  const ps = profile.personaStats[personaId];
  if (!ps || ps.totalTurns < 20) {
    // Not enough data — use defaults
    return { fitPass: DEFAULT_FIT_PASS, fitSoft: DEFAULT_FIT_SOFT, fitHard: DEFAULT_FIT_HARD };
  }

  const corrRate = ps.correctionRate;
  let adapt = 0;

  if (corrRate > HIGH_CORRECTION_RATE) {
    // Too many corrections → relax (lower thresholds)
    adapt = -THRESHOLD_ADAPT_RANGE * Math.min(1, (corrRate - HIGH_CORRECTION_RATE) / 0.3);
  } else if (corrRate < LOW_CORRECTION_RATE) {
    // Very few corrections → tighten (raise thresholds)
    adapt = THRESHOLD_ADAPT_RANGE * Math.min(1, (LOW_CORRECTION_RATE - corrRate) / 0.05);
  }

  return {
    fitPass: +clamp(DEFAULT_FIT_PASS + adapt, 0.55, 0.75).toFixed(3),
    fitSoft: +clamp(DEFAULT_FIT_SOFT + adapt, 0.40, 0.60).toFixed(3),
    fitHard: +clamp(DEFAULT_FIT_HARD + adapt, 0.25, 0.45).toFixed(3),
  };
}

// ────────────────────────────────���───────────────────────────────────��─────────
// Optimization Directive (system prompt injection)
// ──────────────────────────────────��───────────────────────────────────────────

function buildOptimizationDirective(
  log: OptimizationLogEntry[],
  gravity: number,
  totalSessions: number,
): string {
  if (log.length === 0) return '';

  const changes = log.map((e) => `  ${e.target}: ${e.from} → ${e.to} (${e.reason})`).join('\n');

  return `## Self-Optimization [Lv5 · ${totalSessions} sessions learned]
Gravity: ${gravity.toFixed(2)} — ${gravity > 1.05 ? 'assertive anchoring (high trust)' : gravity < 0.95 ? 'gentle anchoring (building trust)' : 'balanced anchoring'}
Adjustments applied this turn:
${changes}
These optimizations reflect learned user resonance patterns. Honor the adjusted weights.`;
}

// ─────────────────────────────────────���────────────────────────────────────────
// Apply optimization result to anchor config (immutable)
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Produce a new AnchorConfig with optimization applied.
 * Does NOT mutate the original.
 */
export function applyOptimization(
  config: AnchorConfig,
  result: OptimizationResult,
): AnchorConfig {
  if (!result.applied) return config;

  return {
    ...config,
    L2_subs: result.optimizedSubs,
    mode: result.suggestedMode ?? config.mode,
  };
}

// ────────────────────────────────────────────────────────────────────��─────────
// Utilities
// ──────────────────────────────────────────────────────────────────────────────

function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v));
}
