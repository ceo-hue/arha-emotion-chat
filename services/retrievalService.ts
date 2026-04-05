/**
 * Retrieval Service — Phase 2 Week 4 (Doc 9 §3.4 Task 2.6, Doc 10 §3.2)
 *
 * Implements Χ_retrieval{query, top_k}: given a query and a candidate set,
 * return the top-k most semantically similar items by cosine similarity.
 *
 * Used for:
 *   - L3 Support Anchor dynamic loading (match user goal → relevant domain snippets)
 *   - anchor_fit_score (cosine(response_embedding, L1_centroid))
 *   - Orthogonality checks on L2 sub dimensions
 */

import { getEmbedding, getEmbeddings } from './embeddingService';
import { cosineSimilarity, topK } from '../utils/vectorMath';

export interface RetrievalCandidate {
  id: string;
  text: string;
  /** Optional pre-computed embedding — skips the provider call when present. */
  embedding?: number[];
  /** Arbitrary metadata passed through to results. */
  meta?: Record<string, unknown>;
}

export interface RetrievalHit {
  id: string;
  text: string;
  score: number;
  meta?: Record<string, unknown>;
}

/**
 * Retrieve the top-k most similar candidates to `query` by cosine similarity.
 * Candidates without pre-computed embeddings are embedded in a single batch call.
 */
export async function retrieveTopK(
  query: string,
  candidates: RetrievalCandidate[],
  k: number,
): Promise<RetrievalHit[]> {
  if (candidates.length === 0 || k <= 0) return [];

  // 1. Embed query
  const queryVec = await getEmbedding(query);

  // 2. Gather candidates needing embedding
  const missingIdx: number[] = [];
  const missingTexts: string[] = [];
  for (let i = 0; i < candidates.length; i++) {
    if (!candidates[i].embedding) {
      missingIdx.push(i);
      missingTexts.push(candidates[i].text);
    }
  }

  // 3. Batch embed missing
  if (missingTexts.length > 0) {
    const vectors = await getEmbeddings(missingTexts);
    for (let j = 0; j < missingIdx.length; j++) {
      candidates[missingIdx[j]].embedding = vectors[j];
    }
  }

  // 4. Score + top-k
  const scored = topK(
    candidates,
    (c) => cosineSimilarity(queryVec, c.embedding!),
    k,
  );

  return scored.map(({ item, score }) => ({
    id: item.id,
    text: item.text,
    score,
    meta: item.meta,
  }));
}

/**
 * Compute anchor_fit_score (Doc 10 §3.2) — cosine similarity between a
 * response text and the centroid of active L1 anchor vectors.
 *
 * Higher is better. Target: > 0.65 for on-anchor responses.
 */
export async function computeAnchorFitScore(
  responseText: string,
  anchorTexts: string[],
): Promise<number> {
  if (anchorTexts.length === 0) return 0;
  const [respVec, ...anchorVecs] = await getEmbeddings([responseText, ...anchorTexts]);
  // Centroid of anchor vectors
  const dim = respVec.length;
  const centroid = new Array(dim).fill(0);
  for (const v of anchorVecs) {
    for (let i = 0; i < dim; i++) centroid[i] += v[i];
  }
  for (let i = 0; i < dim; i++) centroid[i] /= anchorVecs.length;
  return cosineSimilarity(respVec, centroid);
}
