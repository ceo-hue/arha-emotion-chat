/**
 * L3 Support Anchor Selector — Phase 2 Week 4 (Doc 9 §3.4 Tasks 2.8-2.9)
 *
 * Selects the most relevant L3 Support Anchors for a given user goal and
 * injects them into the prompt as dynamic domain knowledge.
 *
 * Two modes:
 *   - `domain`   — keyword + domain-based (heuristic, synchronous, zero cost)
 *   - `similarity` — embedding-based cosine top-k (requires embedding provider)
 *
 * Until VOYAGE_API_KEY is wired, the active runtime uses `domain` mode, which
 * produces deterministic, semantically-meaningful picks via the already-computed
 * Δ_GoalDecompose domains. When the embedding layer goes live, callers can
 * switch to `similarity` mode for cross-domain semantic retrieval.
 */

import supportAnchorsData from '../data/supportAnchors.json';
import type { GoalDecomposition } from './anchorConfig';

// ──────────────────────────────────────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────────────────────────────────────

export interface SupportAnchor {
  id: string;
  domain: string;
  text: string;
  whenToActivate: string;
}

export interface L3Selection {
  id: string;
  domain: string;
  text: string;
  score: number;
  mode: 'domain' | 'similarity';
}

// ──────────────────────────────────────────────────────────────────────────────
// Loaded seed data
// ──────────────────────────────────────────────────────────────────────────────

const ALL_ANCHORS: SupportAnchor[] = (supportAnchorsData as { anchors: SupportAnchor[] }).anchors;

/** Ordered priority when a domain has multiple candidates. Roughly: meta last. */
const DOMAIN_ORDER = ['emotion', 'code', 'design', 'logic', 'creative', 'research', 'meta'];

// ──────────────────────────────────────────────────────────────────────────────
// Domain-mode selector (heuristic, synchronous — default in Phase 2 W4)
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Keyword overlap score between the goal text and an anchor's whenToActivate hint.
 * Used as a tiebreaker when multiple anchors share a domain.
 */
function keywordOverlapScore(goalLower: string, anchor: SupportAnchor): number {
  const words = anchor.whenToActivate.toLowerCase().split(/[^a-z가-힣]+/).filter((w) => w.length >= 3);
  if (words.length === 0) return 0;
  let hits = 0;
  for (const w of words) {
    if (goalLower.includes(w)) hits += 1;
  }
  return hits / words.length;
}

/**
 * Select top-k L3 anchors by domain intersection with the decomposition.
 * Always includes at least one `meta` anchor for cross-cutting wisdom.
 */
export function selectL3ByDomain(
  goal: string,
  decomposition: GoalDecomposition,
  k: number = 3,
): L3Selection[] {
  if (k <= 0) return [];
  const goalLower = goal.toLowerCase();
  const activeDomains = new Set(decomposition.domains);

  // Score every anchor
  const scored = ALL_ANCHORS.map((a) => {
    let score = 0;
    if (activeDomains.has(a.domain)) score += 0.6;         // domain match is primary
    const overlap = keywordOverlapScore(goalLower, a);
    score += overlap * 0.3;                                // keyword reinforcement
    // Meta anchors get a baseline so at least one appears
    if (a.domain === 'meta') score += 0.1;
    return { anchor: a, score };
  });

  // Sort: higher score first, then by DOMAIN_ORDER as tiebreaker
  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return DOMAIN_ORDER.indexOf(a.anchor.domain) - DOMAIN_ORDER.indexOf(b.anchor.domain);
  });

  // Take top-k, but ensure at least one meta if k >= 2 and none selected
  const picked = scored.slice(0, k);
  if (k >= 2 && !picked.some((p) => p.anchor.domain === 'meta')) {
    const firstMeta = scored.find((p) => p.anchor.domain === 'meta');
    if (firstMeta) picked[picked.length - 1] = firstMeta;
  }

  return picked.map(({ anchor, score }) => ({
    id: anchor.id,
    domain: anchor.domain,
    text: anchor.text,
    score: +score.toFixed(3),
    mode: 'domain' as const,
  }));
}

// ──────────────────────────────────────────────────────────────────────────────
// Similarity-mode selector (embedding-based, Phase 2 W4 full version)
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Embedding-based top-k selection. Only meaningful when VOYAGE_API_KEY is set
 * OR when the caller explicitly wants mock-based structural testing.
 *
 * Lazy-imports retrievalService to avoid pulling the embedding chain into bundles
 * where only domain-mode is used.
 */
export async function selectL3BySimilarity(
  goal: string,
  k: number = 3,
): Promise<L3Selection[]> {
  if (k <= 0) return [];
  const { retrieveTopK } = await import('./retrievalService');
  const candidates = ALL_ANCHORS.map((a) => ({
    id: a.id,
    text: a.text,
    meta: { domain: a.domain },
  }));
  const hits = await retrieveTopK(goal, candidates, k);
  return hits.map((h) => ({
    id: h.id,
    domain: (h.meta?.domain as string) ?? 'meta',
    text: h.text,
    score: +h.score.toFixed(3),
    mode: 'similarity' as const,
  }));
}

// ──────────────────────────────────────────────────────────────────────────────
// Unified entry — Phase 3: auto-detects best available mode
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Check if the Voyage embedding provider is available at runtime.
 * Uses lazy import to avoid pulling the embedding chain into every bundle.
 */
function isVoyageAvailable(): boolean {
  try {
    return typeof process !== 'undefined' && !!process.env?.VOYAGE_API_KEY;
  } catch {
    return false;
  }
}

/**
 * Unified L3 selector — Phase 3 auto-mode.
 * - If Voyage API key is available → similarity mode (embedding-based semantic retrieval)
 * - Otherwise → domain mode (keyword-based, synchronous, zero cost)
 *
 * Similarity mode is async; domain mode is sync. Both return L3Selection[].
 */
export function selectL3(
  goal: string,
  decomposition: GoalDecomposition,
  k: number = 3,
): L3Selection[] {
  // Phase 3: auto-switch to similarity mode when Voyage is available
  // Note: similarity mode is async but we return sync for compatibility.
  // For async embedding-based selection, callers should use selectL3BySimilarity directly.
  // The selectL3Async wrapper below provides the auto-switching async path.
  return selectL3ByDomain(goal, decomposition, k);
}

/**
 * Async auto-mode entry — uses similarity when Voyage is available,
 * domain-mode as fallback. Callers who can await should prefer this.
 */
export async function selectL3Async(
  goal: string,
  decomposition: GoalDecomposition,
  k: number = 3,
): Promise<L3Selection[]> {
  if (isVoyageAvailable()) {
    try {
      return await selectL3BySimilarity(goal, k);
    } catch (e) {
      console.warn('⚠ selectL3BySimilarity failed, falling back to domain mode:', e);
      return selectL3ByDomain(goal, decomposition, k);
    }
  }
  return selectL3ByDomain(goal, decomposition, k);
}

/** Format L3 selections as a system-prompt-ready block. */
export function formatL3Block(selections: L3Selection[]): string {
  if (selections.length === 0) return '';
  const lines = selections.map(
    (s) => `  - [${s.domain}] ${s.text}  (id:${s.id}, score:${s.score.toFixed(2)})`,
  );
  return `### L3 Support [task · gravity:0.60 · mode:${selections[0].mode}]
${lines.join('\n')}`;
}

// Re-export the seed for server-side mirrors that want to ship the same data.
export { ALL_ANCHORS as SUPPORT_ANCHORS_SEED };
