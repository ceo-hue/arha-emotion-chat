/**
 * Cost Tracker — Phase 2 Week 5 (Doc 9 §3.3 Task 2.13 + 2.14)
 *
 * Tracks embedding + chat API calls at the session level.
 * Enforces session budget (default 20 embedding calls per session).
 * Exposes monthly projection for the Kill Switch (Doc 9 §10).
 *
 * NOTE: This is a client-side tracker (per-user session). Server-side
 * aggregation would live in Firestore in a later phase.
 */

export interface CallRecord {
  provider: string;
  count: number;      // number of items embedded in this call
  chars: number;      // total characters (proxy for tokens)
  timestamp: number;
}

interface SessionState {
  embeddingCalls: CallRecord[];
  embeddingCallCount: number;   // number of API calls (not items)
  killSwitchTripped: boolean;
}

const state: SessionState = {
  embeddingCalls: [],
  embeddingCallCount: 0,
  killSwitchTripped: false,
};

// ──────────────────────────────────────────────────────────────────────────────
// Config
// ──────────────────────────────────────────────────────────────────────────────

export const SESSION_EMBEDDING_LIMIT = 20;  // per Doc 9 Task 2.14
export const MONTHLY_BUDGET_USD = 100;      // per Doc 9 §3.6
export const KILL_SWITCH_MULTIPLIER = 2;    // per Doc 9 §10

// Voyage-3 pricing: $0.06 / 1M tokens. ~4 chars/token → ~$0.015 per 1M chars.
const VOYAGE_USD_PER_CHAR = 0.06 / 1_000_000 / 4;

// ──────────────────────────────────────────────────────────────────────────────
// Tracking
// ──────────────────────────────────────────────────────────────────────────────

export function trackEmbeddingCall(provider: string, count: number, chars: number): void {
  state.embeddingCalls.push({ provider, count, chars, timestamp: Date.now() });
  state.embeddingCallCount += 1;

  // Kill switch check — if session cost * avg_sessions_per_day * 30 > budget * 2
  const sessionCost = estimateSessionCost();
  // Assume ~100 sessions/day as a conservative projection baseline
  const projectedMonthly = sessionCost * 100 * 30;
  if (projectedMonthly > MONTHLY_BUDGET_USD * KILL_SWITCH_MULTIPLIER) {
    state.killSwitchTripped = true;
    console.warn(
      `[costTracker] Kill switch tripped — projected monthly $${projectedMonthly.toFixed(2)} ` +
      `exceeds 2× budget ($${(MONTHLY_BUDGET_USD * KILL_SWITCH_MULTIPLIER).toFixed(2)}).`,
    );
  }
}

/**
 * Returns true if the session is within the embedding call limit AND the
 * kill switch has not been tripped.
 */
export function sessionWithinBudget(): boolean {
  if (state.killSwitchTripped) return false;
  return state.embeddingCallCount < SESSION_EMBEDDING_LIMIT;
}

/** Estimated cost for the current session (USD). */
export function estimateSessionCost(): number {
  let totalChars = 0;
  for (const c of state.embeddingCalls) {
    if (c.provider.startsWith('voyage')) totalChars += c.chars;
  }
  return totalChars * VOYAGE_USD_PER_CHAR;
}

export function getSessionStats(): {
  embeddingCallCount: number;
  totalItems: number;
  totalChars: number;
  estimatedCost: number;
  killSwitchTripped: boolean;
  withinBudget: boolean;
} {
  let totalItems = 0;
  let totalChars = 0;
  for (const c of state.embeddingCalls) {
    totalItems += c.count;
    totalChars += c.chars;
  }
  return {
    embeddingCallCount: state.embeddingCallCount,
    totalItems,
    totalChars,
    estimatedCost: estimateSessionCost(),
    killSwitchTripped: state.killSwitchTripped,
    withinBudget: sessionWithinBudget(),
  };
}

/** For tests + new session boundaries. */
export function resetSessionStats(): void {
  state.embeddingCalls = [];
  state.embeddingCallCount = 0;
  state.killSwitchTripped = false;
}
