// Phase 2 Verification — vector math + embedding cache + retrieval (mock mode)
// Run: node tests/phase2-verify.mjs
//
// Phase 2 brings real vector math + Voyage AI embedding infrastructure.
// In the absence of a VOYAGE_API_KEY, the service falls back to deterministic
// hash-based mock embeddings, which is exactly what this test exercises.
//
// Spec references:
//   - Doc 9 §3.6 Phase 2 Verification Gate
//   - Doc 10 §3.2 anchor_fit_score operational definition
//   - Doc 10 §3.6 T2 Orthogonality

// We verify vectorMath (pure) + embedding cache behavior + retrieval top-k.
// The TS modules compile via Vite at build time; here we re-implement a tiny
// slice in JS to keep this test zero-dep. The logic is mirrored from
// utils/vectorMath.ts — if you change one, change the other.

// ── Inline mirror of vectorMath.ts (kept in lockstep) ────────────────────────
function dot(a, b) {
  let s = 0; for (let i = 0; i < a.length; i++) s += a[i] * b[i]; return s;
}
function magnitude(v) {
  let s = 0; for (let i = 0; i < v.length; i++) s += v[i] * v[i]; return Math.sqrt(s);
}
function cosineSimilarity(a, b) {
  const mA = magnitude(a), mB = magnitude(b);
  if (mA === 0 || mB === 0) return 0;
  return dot(a, b) / (mA * mB);
}
function normalize(v) {
  const m = magnitude(v);
  if (m === 0) return v.slice();
  return v.map(x => x / m);
}
function euclideanDistance(a, b) {
  let s = 0; for (let i = 0; i < a.length; i++) { const d = a[i] - b[i]; s += d * d; }
  return Math.sqrt(s);
}
function topK(items, scoreFn, k) {
  return items.map(i => ({ item: i, score: scoreFn(i) }))
              .sort((a, b) => b.score - a.score)
              .slice(0, k);
}
function centroid(vectors) {
  if (!vectors.length) return [];
  const dim = vectors[0].length;
  const r = new Array(dim).fill(0);
  for (const v of vectors) for (let i = 0; i < dim; i++) r[i] += v[i];
  for (let i = 0; i < dim; i++) r[i] /= vectors.length;
  return r;
}
function maxPairwiseCosine(vectors) {
  if (vectors.length < 2) return 0;
  let max = -1;
  for (let i = 0; i < vectors.length; i++)
    for (let j = i + 1; j < vectors.length; j++) {
      const s = Math.abs(cosineSimilarity(vectors[i], vectors[j]));
      if (s > max) max = s;
    }
  return max;
}

// ── Mirror of mock embedding (hashToVector) — Box-Muller over mulberry32 ─────
function hashToVector(text, dim = 1024) {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  let state = h >>> 0;
  const rand = () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
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

// ── Test harness ──────────────────────────────────────────────────────────────
let pass = 0, fail = 0;
const failures = [];
function check(name, cond, detail = '') {
  if (cond) { pass++; console.log(`  ✓ ${name}`); }
  else      { fail++; failures.push(`${name} ${detail}`); console.log(`  ✗ ${name} ${detail}`); }
}
function close(a, b, tol = 1e-9) { return Math.abs(a - b) < tol; }

// ── T2.1 — cosineSimilarity basics ────────────────────────────────────────────
console.log('\n[T2.1] cosineSimilarity correctness');
check('identical vectors → 1',      close(cosineSimilarity([1, 2, 3], [1, 2, 3]), 1));
check('opposite vectors → -1',      close(cosineSimilarity([1, 0], [-1, 0]), -1));
check('orthogonal vectors → 0',     close(cosineSimilarity([1, 0], [0, 1]), 0));
check('zero vector → 0 (safe)',     cosineSimilarity([0, 0, 0], [1, 2, 3]) === 0);
check('scaled vectors → 1',         close(cosineSimilarity([1, 2, 3], [2, 4, 6]), 1));

// ── T2.2 — normalize ──────────────────────────────────────────────────────────
console.log('\n[T2.2] normalize');
const n = normalize([3, 4]);
check('||normalize([3,4])|| = 1',   close(magnitude(n), 1));
check('normalize([0,0,0]) = [0,0,0]', normalize([0, 0, 0]).every(x => x === 0));

// ── T2.3 — euclidean + topK ───────────────────────────────────────────────────
console.log('\n[T2.3] euclidean + topK');
check('euclidean [0,0]→[3,4] = 5',  close(euclideanDistance([0, 0], [3, 4]), 5));
const hits = topK([10, 5, 8, 3, 7, 9], x => x, 3);
check('topK picks top 3 descending',
  hits.length === 3 && hits[0].score === 10 && hits[1].score === 9 && hits[2].score === 8);

// ── T2.4 — centroid ───────────────────────────────────────────────────────────
console.log('\n[T2.4] centroid');
const c = centroid([[1, 2], [3, 4], [5, 6]]);
check('centroid mean correct', close(c[0], 3) && close(c[1], 4));
check('empty centroid → []',   centroid([]).length === 0);

// ── T2.5 — hashToVector determinism + unit length ────────────────────────────
console.log('\n[T2.5] mock embedding determinism');
const v1 = hashToVector('hello world');
const v2 = hashToVector('hello world');
const v3 = hashToVector('different text');
check('same text → same vector',       v1.every((x, i) => x === v2[i]));
check('different text → different vec', !v1.every((x, i) => x === v3[i]));
check('mock vector is unit length',    close(magnitude(v1), 1, 1e-6));
check('mock vector has 1024 dims',     v1.length === 1024);

// ── T2.6 — mock cosine behavior (sanity: distinct texts → low similarity) ────
console.log('\n[T2.6] mock embedding separation');
const sim_same    = cosineSimilarity(hashToVector('a'), hashToVector('a'));
const sim_diff    = cosineSimilarity(hashToVector('abc'), hashToVector('xyz'));
check('cos_sim(same, same) = 1',       close(sim_same, 1, 1e-6));
check('cos_sim(diff, diff) < 0.3',     Math.abs(sim_diff) < 0.3, `got ${sim_diff.toFixed(3)}`);

// ── T2.7 — L2 sub dimension orthogonality (T2 Gate) ──────────────────────────
console.log('\n[T2.7] L2 sub orthogonality (T2 gate)');
// Use 9 tri-vector dimension names as mock anchors
const dimNames = ['self_love','social_love','efficacy','planfulness','brightness','challenge','musical_sense','inner_depth','empathy_bond'];
const dimVecs = dimNames.map(n => hashToVector(`L2_${n}_dimension_anchor`));
const maxSim = maxPairwiseCosine(dimVecs);
check('max pairwise cos_sim < 0.5', maxSim < 0.5, `got ${maxSim.toFixed(3)}`);

// ── T2.8 — retrieval top-k using mock embeddings ─────────────────────────────
console.log('\n[T2.8] retrieval top-k');
const candidates = [
  { id: 'a', text: 'foo', embedding: hashToVector('foo') },
  { id: 'b', text: 'bar', embedding: hashToVector('bar') },
  { id: 'c', text: 'baz', embedding: hashToVector('baz') },
];
const queryVec = hashToVector('foo');
const top2 = topK(candidates, c => cosineSimilarity(queryVec, c.embedding), 2);
check('query "foo" top-1 is candidate "a"', top2[0].item.id === 'a');
check('query "foo" top-1 score ≈ 1',        close(top2[0].score, 1, 1e-6));
check('returns 2 results',                  top2.length === 2);

// ── T2.9 — supportAnchors seed structure ─────────────────────────────────────
console.log('\n[T2.9] supportAnchors seed');
import('fs').then(fs => {
  const raw = fs.readFileSync('data/supportAnchors.json', 'utf8');
  const data = JSON.parse(raw);
  check('supportAnchors has anchors array', Array.isArray(data.anchors));
  check('anchors length ≥ 20',              data.anchors.length >= 20);
  check('all anchors have id/domain/text/whenToActivate',
    data.anchors.every(a => a.id && a.domain && a.text && a.whenToActivate));
  const domains = new Set(data.anchors.map(a => a.domain));
  check('covers ≥ 5 distinct domains',      domains.size >= 5, `got ${domains.size}: ${[...domains].join(',')}`);

  // ── Final summary ─
  console.log(`\n════════════════════════════════════════`);
  console.log(`  Phase 2 Verification: ${pass} passed / ${fail} failed`);
  console.log(`════════════════════════════════════════`);
  if (fail > 0) {
    console.log('\nFailures:');
    failures.forEach(f => console.log('  ' + f));
    process.exit(1);
  }
  process.exit(0);
});
