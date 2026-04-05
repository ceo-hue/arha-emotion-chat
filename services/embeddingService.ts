/**
 * Embedding Service — Phase 2 Week 3 (per Doc 9 §3.3 Tasks 2.2 + 2.3 + 2.14)
 *
 * Provides embeddings via Voyage AI with graceful degradation:
 *   - If VOYAGE_API_KEY is set → real Voyage-3 (1024 dim)
 *   - Otherwise → deterministic mock embeddings (hash-based, 1024 dim)
 *
 * Features:
 *   - LRU memory cache (500 entries) — 캐시 히트율 ≥ 95% 목표 (Doc 9 §3.6)
 *   - Session call limit (default 20/session, Task 2.14)
 *   - Cost tracking hook (utils/costTracker)
 *
 * NOTE: The live HTTP client is only used in environments where fetch can
 * reach api.voyageai.com. In local/sandbox runs, the mock provider kicks in,
 * which still produces deterministic (text → same vector) embeddings so that
 * cosine similarity tests are reproducible.
 */

import { normalize } from '../utils/vectorMath';
import { trackEmbeddingCall, sessionWithinBudget } from '../utils/costTracker';

// ──────────────────────────────────────────────────────────────────────────────
// Types + Config
// ──────────────────────────────────────────────────────────────────────────────

export const EMBEDDING_DIM = 1024; // voyage-3 dimension
export const DEFAULT_SESSION_LIMIT = 20;
const CACHE_CAPACITY = 500;

export interface EmbeddingProvider {
  name: string;
  embed(texts: string[]): Promise<number[][]>;
}

// ──────────────────────────────────────────────────────────────────────────────
// LRU Cache
// ──────────────────────────────────────────────────────────────────────────────

class LRUCache<K, V> {
  private map = new Map<K, V>();
  constructor(private capacity: number) {}

  get(key: K): V | undefined {
    const v = this.map.get(key);
    if (v === undefined) return undefined;
    // refresh insertion order
    this.map.delete(key);
    this.map.set(key, v);
    return v;
  }

  set(key: K, value: V): void {
    if (this.map.has(key)) this.map.delete(key);
    else if (this.map.size >= this.capacity) {
      const oldest = this.map.keys().next().value;
      if (oldest !== undefined) this.map.delete(oldest);
    }
    this.map.set(key, value);
  }

  has(key: K): boolean {
    return this.map.has(key);
  }

  get size(): number {
    return this.map.size;
  }

  clear(): void {
    this.map.clear();
  }
}

const cache = new LRUCache<string, number[]>(CACHE_CAPACITY);

// ──────────────────────────────────────────────────────────────────────────────
// Cache-hit telemetry (Doc 9 §3.6 — 캐시 히트율 > 95%)
// ──────────────────────────────────────────────────────────────────────────────

let cacheHits = 0;
let cacheLookups = 0;

export function getCacheHitRate(): number {
  return cacheLookups === 0 ? 1 : cacheHits / cacheLookups;
}

export function getCacheStats(): { hits: number; lookups: number; size: number; rate: number } {
  return { hits: cacheHits, lookups: cacheLookups, size: cache.size, rate: getCacheHitRate() };
}

export function resetCacheStats(): void {
  cacheHits = 0;
  cacheLookups = 0;
}

// ──────────────────────────────────────────────────────────────────────────────
// Mock Provider — deterministic hash-based embeddings (offline/dev fallback)
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Deterministic 1024-dim embedding from a text hash. Same text → same vector.
 * NOT semantically meaningful — for development + offline testing only.
 * Uses FNV-1a as seed + mulberry32 PRNG + Box-Muller to generate pseudo-Gaussian
 * coordinates, giving ~orthogonal vectors for distinct inputs.
 */
function hashToVector(text: string, dim: number = EMBEDDING_DIM): number[] {
  // FNV-1a 32-bit → seed
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  // mulberry32 PRNG seeded by the hash
  let state = h >>> 0;
  const rand = (): number => {
    state = (state + 0x6d2b79f5) | 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  // Box-Muller → Gaussian coords (high-dim Gaussians are ~orthogonal)
  const v = new Array(dim);
  for (let i = 0; i < dim; i += 2) {
    const u1 = Math.max(rand(), 1e-12);
    const u2 = rand();
    const mag = Math.sqrt(-2 * Math.log(u1));
    const ang = 2 * Math.PI * u2;
    v[i] = mag * Math.cos(ang);
    if (i + 1 < dim) v[i + 1] = mag * Math.sin(ang);
  }
  return normalize(v);
}

const mockProvider: EmbeddingProvider = {
  name: 'mock',
  async embed(texts: string[]): Promise<number[][]> {
    return texts.map((t) => hashToVector(t));
  },
};

// ──────────────────────────────────────────────────────────────────────────────
// Voyage AI Provider (live)
// ──────────────────────────────────────────────────────────────────────────────

const voyageProvider: EmbeddingProvider = {
  name: 'voyage-3',
  async embed(texts: string[]): Promise<number[][]> {
    const apiKey = (typeof process !== 'undefined' && process.env?.VOYAGE_API_KEY) || '';
    if (!apiKey) throw new Error('VOYAGE_API_KEY not set');

    const res = await fetch('https://api.voyageai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        input: texts,
        model: 'voyage-3',
        input_type: 'document',
      }),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`Voyage API error ${res.status}: ${text}`);
    }

    const data = await res.json();
    if (!data.data || !Array.isArray(data.data)) {
      throw new Error('Voyage API: malformed response');
    }
    return data.data.map((d: { embedding: number[] }) => d.embedding);
  },
};

// ──────────────────────────────────────────────────────────────────────────────
// Provider selection
// ──────────────────────────────────────────────────────────────────────────────

function resolveProvider(): EmbeddingProvider {
  const hasKey =
    typeof process !== 'undefined' && !!process.env?.VOYAGE_API_KEY;
  return hasKey ? voyageProvider : mockProvider;
}

export function getActiveProviderName(): string {
  return resolveProvider().name;
}

// ──────────────────────────────────────────────────────────────────────────────
// Public API
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Embed a single text. Cache-first, then provider call.
 * Respects session budget — returns zero vector if over limit (graceful).
 */
export async function getEmbedding(text: string): Promise<number[]> {
  const key = text.trim();
  cacheLookups++;
  const cached = cache.get(key);
  if (cached) {
    cacheHits++;
    return cached;
  }

  if (!sessionWithinBudget()) {
    // Budget exceeded — fall back to deterministic mock so caller still works
    const v = hashToVector(key);
    cache.set(key, v);
    return v;
  }

  const provider = resolveProvider();
  const [vec] = await provider.embed([key]);
  trackEmbeddingCall(provider.name, 1, key.length);
  cache.set(key, vec);
  return vec;
}

/**
 * Batch embed. Skips items already in cache; issues one provider call for misses.
 */
export async function getEmbeddings(texts: string[]): Promise<number[][]> {
  const result: (number[] | null)[] = new Array(texts.length).fill(null);
  const missIdx: number[] = [];
  const missTexts: string[] = [];

  for (let i = 0; i < texts.length; i++) {
    const key = texts[i].trim();
    cacheLookups++;
    const cached = cache.get(key);
    if (cached) {
      cacheHits++;
      result[i] = cached;
    } else {
      missIdx.push(i);
      missTexts.push(key);
    }
  }

  if (missTexts.length === 0) return result as number[][];

  if (!sessionWithinBudget()) {
    for (let k = 0; k < missIdx.length; k++) {
      const v = hashToVector(missTexts[k]);
      cache.set(missTexts[k], v);
      result[missIdx[k]] = v;
    }
    return result as number[][];
  }

  const provider = resolveProvider();
  const vectors = await provider.embed(missTexts);
  trackEmbeddingCall(
    provider.name,
    missTexts.length,
    missTexts.reduce((a, t) => a + t.length, 0),
  );
  for (let k = 0; k < missIdx.length; k++) {
    cache.set(missTexts[k], vectors[k]);
    result[missIdx[k]] = vectors[k];
  }
  return result as number[][];
}

/** For tests only — wipes the in-memory cache. */
export function __resetEmbeddingCache(): void {
  cache.clear();
  resetCacheStats();
}
