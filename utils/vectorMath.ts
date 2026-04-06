/**
 * Vector Math Utilities — Phase 2 foundation (per Doc 10 §3.2, §3.6)
 *
 * Pure functions, zero dependencies, fully deterministic.
 * All functions operate on plain number[] arrays (embedding vectors).
 *
 * Used by:
 *   - services/embeddingService.ts (caching + normalization)
 *   - services/retrievalService.ts (Χ_retrieval top-k)
 *   - Phase 2 Orthogonality + Drift tests
 */

/** Dot product of two equal-length vectors. */
export function dot(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error(`vector length mismatch: ${a.length} vs ${b.length}`);
  }
  let sum = 0;
  for (let i = 0; i < a.length; i++) sum += a[i] * b[i];
  return sum;
}

/** Euclidean magnitude (L2 norm). */
export function magnitude(v: number[]): number {
  let sum = 0;
  for (let i = 0; i < v.length; i++) sum += v[i] * v[i];
  return Math.sqrt(sum);
}

/** Cosine similarity in [-1, 1]. Returns 0 for zero vectors (safe fallback). */
export function cosineSimilarity(a: number[], b: number[]): number {
  const magA = magnitude(a);
  const magB = magnitude(b);
  if (magA === 0 || magB === 0) return 0;
  return dot(a, b) / (magA * magB);
}

/** L2-normalize a vector. Returns zero vector unchanged. */
export function normalize(v: number[]): number[] {
  const m = magnitude(v);
  if (m === 0) return v.slice();
  return v.map((x) => x / m);
}

/** Euclidean distance. */
export function euclideanDistance(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error(`vector length mismatch: ${a.length} vs ${b.length}`);
  }
  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    const d = a[i] - b[i];
    sum += d * d;
  }
  return Math.sqrt(sum);
}

/**
 * Top-k selection by score (descending).
 * Partial sort — O(n log k) for large n, small k.
 */
export function topK<T>(
  items: T[],
  scoreFn: (item: T) => number,
  k: number,
): Array<{ item: T; score: number }> {
  if (k <= 0) return [];
  const scored = items.map((item) => ({ item, score: scoreFn(item) }));
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, k);
}

/**
 * Centroid (mean) of multiple vectors. Returns zero vector if input empty.
 * All input vectors must be the same dimension.
 */
export function centroid(vectors: number[][]): number[] {
  if (vectors.length === 0) return [];
  const dim = vectors[0].length;
  const result = new Array(dim).fill(0);
  for (const v of vectors) {
    if (v.length !== dim) {
      throw new Error(`centroid: dimension mismatch ${v.length} vs ${dim}`);
    }
    for (let i = 0; i < dim; i++) result[i] += v[i];
  }
  for (let i = 0; i < dim; i++) result[i] /= vectors.length;
  return result;
}

/**
 * Check orthogonality of a set of vectors (Doc 10 §3.6 T2).
 * Returns the maximum pairwise cosine similarity — lower is more orthogonal.
 * Threshold per spec: max pairwise < 0.5 for L2 sub dimensions.
 */
export function maxPairwiseCosine(vectors: number[][]): number {
  if (vectors.length < 2) return 0;
  let maxSim = -1;
  for (let i = 0; i < vectors.length; i++) {
    for (let j = i + 1; j < vectors.length; j++) {
      const sim = Math.abs(cosineSimilarity(vectors[i], vectors[j]));
      if (sim > maxSim) maxSim = sim;
    }
  }
  return maxSim;
}
