/**
 * User Anchor Profile — Phase 5 (Cross-Session Personalization)
 *
 * Learns optimal anchor combinations per user across sessions.
 * Extends the existing emotionProfile Firestore schema with a new
 * `anchorProfile` document that tracks:
 *
 *   - Per-persona anchor performance (fit scores, correction frequency)
 *   - Per-vector preference weights (which L1 vectors correlate with high fit)
 *   - Per-dimension affinity (which L2 dims the user responds to best)
 *   - κ-based gravity auto-tuning (trust level → anchor assertiveness)
 *   - Session-over-session learning via EMA blending
 *
 * Firestore path: users/{uid}/emotionProfile/anchorProfile
 *
 * This is the module that makes ARHA remember not just what you said,
 * but how you best resonated — and adjusts the anchor field accordingly.
 */

import {
  doc,
  getDoc,
  setDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../firebase';
import type { FeedbackState, FitEvaluation } from './anchorFeedback';
import type { AnchorConfig, L1VectorKey, AnchorMode } from './anchorConfig';

// ──────────────────────────────────────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────────────────────────────────────

export interface DimensionAffinity {
  /** Dimension name (e.g., 'self_love', 'empathy_bond') */
  dimension: string;
  /** EMA-blended affinity score [0, 1] — higher = user responds well to this dim */
  affinity: number;
  /** Total times this dimension appeared in anchor config */
  exposures: number;
  /** Total times the response hit this dimension's keywords */
  hits: number;
}

export interface VectorPreference {
  /** L1 vector key */
  vector: L1VectorKey;
  /** EMA-blended preference score [0, 1] — higher = better fit when this vector leads */
  preference: number;
  /** Sessions where this vector was primary */
  sessionCount: number;
  /** Average fit when this vector leads */
  avgFit: number;
}

export interface PersonaAnchorStats {
  /** Persona ID */
  personaId: string;
  /** Total sessions with this persona */
  sessionCount: number;
  /** EMA-blended average fit score */
  avgFit: number;
  /** Correction frequency (corrections / total turns) */
  correctionRate: number;
  /** Total corrections issued */
  totalCorrections: number;
  /** Total turns */
  totalTurns: number;
  /** Most effective anchor mode for this user+persona */
  bestMode: AnchorMode | null;
  /** Mode → average fit mapping */
  modeFitMap: Partial<Record<AnchorMode, { totalFit: number; count: number }>>;
}

export interface UserAnchorProfile {
  /** Per-dimension affinity scores */
  dimensionAffinities: Record<string, DimensionAffinity>;
  /** Per-L1-vector preference scores */
  vectorPreferences: Record<L1VectorKey, VectorPreference>;
  /** Per-persona anchor performance stats */
  personaStats: Record<string, PersonaAnchorStats>;
  /** κ-weighted gravity multiplier [0.8, 1.2] — modulates anchor assertiveness */
  gravityMultiplier: number;
  /** Optimal L2 sub count learned from fit patterns */
  optimalSubCount: number;
  /** Total sessions contributing to this profile */
  totalSessions: number;
  /** Last update timestamp */
  updatedAt: unknown; // Firestore serverTimestamp
}

// ──────────────────────────────────────────────────────────────────────────────
// Constants
// ──────────────────────────────────────────────────────────────────────────────

const ANCHOR_PROFILE_ALPHA = 0.2;    // EMA learning rate — 20% new, 80% history
const GRAVITY_BASE = 1.0;
const GRAVITY_MIN = 0.8;
const GRAVITY_MAX = 1.2;
const MIN_SESSIONS_FOR_LEARNING = 3;  // Don't apply learned weights until 3 sessions

// All 9 tri-vector dimensions
const ALL_DIMENSIONS = [
  'self_love', 'social_love', 'efficacy',
  'planfulness', 'brightness', 'challenge',
  'musical_sense', 'inner_depth', 'empathy_bond',
];

const ALL_L1_VECTORS: L1VectorKey[] = ['V_Agency', 'V_Morning', 'V_Musical'];

// ──────────────────────────────────────────────────────────────────────────────
// Create initial profile
// ──────────────────────────────────────────────────────────────────────────────

export function createInitialAnchorProfile(): UserAnchorProfile {
  const dimensionAffinities: Record<string, DimensionAffinity> = {};
  for (const dim of ALL_DIMENSIONS) {
    dimensionAffinities[dim] = { dimension: dim, affinity: 0.5, exposures: 0, hits: 0 };
  }

  const vectorPreferences: Record<L1VectorKey, VectorPreference> = {} as any;
  for (const vec of ALL_L1_VECTORS) {
    vectorPreferences[vec] = { vector: vec, preference: 0.5, sessionCount: 0, avgFit: 0.5 };
  }

  return {
    dimensionAffinities,
    vectorPreferences,
    personaStats: {},
    gravityMultiplier: GRAVITY_BASE,
    optimalSubCount: 3,
    totalSessions: 0,
    updatedAt: null,
  };
}

// ──────────────────────────────────────────────────────────────────────────────
// Learn from a completed session's feedback history
// ──────────────────────────────────────────────────────────────────────────────

export interface SessionLearningInput {
  personaId: string;
  anchorConfig: AnchorConfig;
  feedbackState: FeedbackState;
  /** All fit evaluations from this session */
  fitEvaluations: FitEvaluation[];
  /** Session kappa (trust level) at end */
  kappaEnd: number;
}

/**
 * Core learning function — updates the profile based on one completed session.
 * Uses EMA blending so recent sessions have more weight but history is preserved.
 *
 * This is the "memory" that makes ARHA improve per user over time.
 */
export function learnFromSession(
  profile: UserAnchorProfile,
  input: SessionLearningInput,
): UserAnchorProfile {
  const { personaId, anchorConfig, feedbackState, fitEvaluations, kappaEnd } = input;
  const updated = structuredClone(profile);

  if (fitEvaluations.length === 0) return updated;

  // 1. Aggregate session fit stats
  const sessionAvgFit = fitEvaluations.reduce((s, e) => s + e.overallFit, 0) / fitEvaluations.length;
  const sessionCorrectionRate = feedbackState.correctionCount / Math.max(feedbackState.turnIndex, 1);

  // 2. Update dimension affinities
  for (const evalItem of fitEvaluations) {
    for (const dimHit of evalItem.dimensionHits) {
      const aff = updated.dimensionAffinities[dimHit.dimension];
      if (!aff) continue;
      aff.exposures++;
      if (dimHit.hit) {
        aff.hits++;
        // Boost affinity when dimension is hit AND overall fit is good
        if (evalItem.overallFit >= 0.65) {
          aff.affinity = ema(aff.affinity, Math.min(1, aff.affinity + 0.05), ANCHOR_PROFILE_ALPHA);
        }
      } else {
        // Slight decay when dimension is missed
        aff.affinity = ema(aff.affinity, Math.max(0, aff.affinity - 0.02), ANCHOR_PROFILE_ALPHA);
      }
    }
  }

  // 3. Update vector preferences
  for (const l1 of anchorConfig.L1_main) {
    const pref = updated.vectorPreferences[l1.key];
    if (!pref) continue;
    pref.sessionCount++;
    pref.avgFit = ema(pref.avgFit, sessionAvgFit, ANCHOR_PROFILE_ALPHA);
    pref.preference = ema(pref.preference, sessionAvgFit, ANCHOR_PROFILE_ALPHA);
  }

  // 4. Update persona stats
  if (!updated.personaStats[personaId]) {
    updated.personaStats[personaId] = {
      personaId,
      sessionCount: 0,
      avgFit: 0.5,
      correctionRate: 0,
      totalCorrections: 0,
      totalTurns: 0,
      bestMode: null,
      modeFitMap: {},
    };
  }
  const ps = updated.personaStats[personaId];
  ps.sessionCount++;
  ps.avgFit = ema(ps.avgFit, sessionAvgFit, ANCHOR_PROFILE_ALPHA);
  ps.correctionRate = ema(ps.correctionRate, sessionCorrectionRate, ANCHOR_PROFILE_ALPHA);
  ps.totalCorrections += feedbackState.correctionCount;
  ps.totalTurns += feedbackState.turnIndex;

  // Track mode performance
  const mode = anchorConfig.mode;
  if (!ps.modeFitMap[mode]) ps.modeFitMap[mode] = { totalFit: 0, count: 0 };
  ps.modeFitMap[mode]!.totalFit += sessionAvgFit;
  ps.modeFitMap[mode]!.count++;

  // Determine best mode
  let bestModeFit = -1;
  for (const [m, data] of Object.entries(ps.modeFitMap)) {
    if (!data || data.count < 2) continue; // Need at least 2 sessions for reliability
    const avg = data.totalFit / data.count;
    if (avg > bestModeFit) {
      bestModeFit = avg;
      ps.bestMode = m as AnchorMode;
    }
  }

  // 5. κ-based gravity multiplier
  // High kappa (trust) → can be more assertive with anchors (gravity up)
  // Low kappa → gentler anchoring (gravity down)
  const kappaGravity = GRAVITY_MIN + (GRAVITY_MAX - GRAVITY_MIN) * kappaEnd;
  updated.gravityMultiplier = ema(updated.gravityMultiplier, kappaGravity, ANCHOR_PROFILE_ALPHA);
  updated.gravityMultiplier = clamp(updated.gravityMultiplier, GRAVITY_MIN, GRAVITY_MAX);

  // 6. Optimal sub count — based on which count gives best fit
  const subCountFitMap: Record<number, number[]> = {};
  for (const ev of fitEvaluations) {
    const count = anchorConfig.L2_subs.length;
    if (!subCountFitMap[count]) subCountFitMap[count] = [];
    subCountFitMap[count].push(ev.overallFit);
  }
  let bestSubCount = updated.optimalSubCount;
  let bestSubFit = -1;
  for (const [count, fits] of Object.entries(subCountFitMap)) {
    const avg = fits.reduce((a, b) => a + b, 0) / fits.length;
    if (avg > bestSubFit) {
      bestSubFit = avg;
      bestSubCount = parseInt(count);
    }
  }
  updated.optimalSubCount = bestSubCount;

  updated.totalSessions++;
  return updated;
}

// ──────────────────────────────────────────────────────────────────────────────
// Generate personalized anchor adjustments for next session
// ──────────────────────────────────────────────────────────────────────────────

export interface AnchorPersonalization {
  /** Dimension weight boosts/penalties to apply */
  dimensionWeights: Record<string, number>;
  /** Gravity multiplier for this session */
  gravityMultiplier: number;
  /** Suggested anchor mode (null = use default complexity-based) */
  suggestedMode: AnchorMode | null;
  /** Whether profile has enough data to be reliable */
  reliable: boolean;
  /** Human-readable summary for system prompt */
  promptSummary: string;
}

/**
 * Generate personalized anchor adjustments based on learned profile.
 * Called at session start to bias the anchor field toward the user's
 * historically best-performing configuration.
 */
export function getPersonalization(
  profile: UserAnchorProfile,
  personaId: string,
): AnchorPersonalization {
  const reliable = profile.totalSessions >= MIN_SESSIONS_FOR_LEARNING;

  if (!reliable) {
    return {
      dimensionWeights: {},
      gravityMultiplier: GRAVITY_BASE,
      suggestedMode: null,
      reliable: false,
      promptSummary: '',
    };
  }

  // Dimension weight adjustments: boost high-affinity, slight penalty for low
  const dimensionWeights: Record<string, number> = {};
  for (const [dim, aff] of Object.entries(profile.dimensionAffinities)) {
    if (aff.exposures < 5) continue; // Not enough data
    const deviation = aff.affinity - 0.5; // Centered around neutral
    if (Math.abs(deviation) > 0.1) {
      dimensionWeights[dim] = +(deviation * 0.2).toFixed(3); // Scale to ±0.1 max
    }
  }

  // Persona-specific mode suggestion
  const ps = profile.personaStats[personaId];
  const suggestedMode = ps?.bestMode ?? null;

  // Build prompt summary
  const topDims = Object.entries(profile.dimensionAffinities)
    .sort((a, b) => b[1].affinity - a[1].affinity)
    .slice(0, 3)
    .map(([dim, aff]) => `${dim}(${aff.affinity.toFixed(2)})`);

  const topVec = Object.entries(profile.vectorPreferences)
    .sort((a, b) => b[1].preference - a[1].preference)
    .map(([, pref]) => `${pref.vector}(${pref.preference.toFixed(2)})`);

  const promptSummary = `## User Anchor Profile [learned · sessions:${profile.totalSessions}]
Gravity: ${profile.gravityMultiplier.toFixed(2)} | Optimal subs: ${profile.optimalSubCount}
Top dimensions: ${topDims.join(', ')}
Vector preference: ${topVec.join(' > ')}
${ps ? `Persona ${personaId}: avgFit=${ps.avgFit.toFixed(2)}, corrRate=${ps.correctionRate.toFixed(2)}${suggestedMode ? `, bestMode=${suggestedMode}` : ''}` : ''}
Apply dimension weights to L2 sub scoring — boost high-affinity, reduce low-affinity.`;

  return {
    dimensionWeights,
    gravityMultiplier: profile.gravityMultiplier,
    suggestedMode,
    reliable,
    promptSummary,
  };
}

// ──────────────────────────────────────────────────────────────────────────────
// Firestore persistence
// ──────────────────────────────────────────────────────────────────────────────

const ANCHOR_PROFILE_DOC = 'anchorProfile';

export async function loadAnchorProfile(uid: string): Promise<UserAnchorProfile> {
  try {
    const ref = doc(db, 'users', uid, 'emotionProfile', ANCHOR_PROFILE_DOC);
    const snap = await getDoc(ref);
    if (snap.exists()) {
      const data = snap.data() as UserAnchorProfile;
      // Ensure all dimensions exist (migration safety)
      for (const dim of ALL_DIMENSIONS) {
        if (!data.dimensionAffinities[dim]) {
          data.dimensionAffinities[dim] = { dimension: dim, affinity: 0.5, exposures: 0, hits: 0 };
        }
      }
      for (const vec of ALL_L1_VECTORS) {
        if (!data.vectorPreferences[vec]) {
          data.vectorPreferences[vec] = { vector: vec, preference: 0.5, sessionCount: 0, avgFit: 0.5 };
        }
      }
      return data;
    }
  } catch (e) {
    console.warn('Failed to load anchor profile:', e);
  }
  return createInitialAnchorProfile();
}

export async function saveAnchorProfile(uid: string, profile: UserAnchorProfile): Promise<void> {
  try {
    const ref = doc(db, 'users', uid, 'emotionProfile', ANCHOR_PROFILE_DOC);
    await setDoc(ref, { ...profile, updatedAt: serverTimestamp() }, { merge: true });
  } catch (e) {
    console.warn('Failed to save anchor profile:', e);
  }
}

// ──────────────────────────────────────────────────────────────────────────────
// Utilities
// ──────────────────────────────────────────────────────────────────────────────

function ema(prev: number, next: number, alpha: number): number {
  return +(alpha * next + (1 - alpha) * prev).toFixed(4);
}

function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v));
}
