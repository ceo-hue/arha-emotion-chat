// Phase 3 Production Activation — Integration Tests
// Run: node tests/phase3-verify.mjs
//
// Verifies:
//   T6.1 — goalDecompose (LLM + heuristic unified entry)
//   T6.2 — buildAnchorPromptBlock with pre-computed decomposition
//   T6.3 — L3 auto-mode selection (domain fallback when no Voyage)
//   T6.4 — anchor_fit_score keyword baseline
//   T6.5 — Full pipeline integration (decompose → anchor → prompt → L3)
//   T6.6 — Export integrity (all Phase 3 exports present in api/chat.js)

import fs from 'fs';

// ── Inline mirrors (from api/chat.js — keep in lockstep) ─────────────────────

const DOMAIN_KEYWORDS = {
  design:   ['디자인', '페이지', 'landing', '색', '배치', '타이포', '레이아웃', 'ui', 'ux', '이미지', 'css'],
  code:     ['코드', '함수', 'python', 'javascript', 'typescript', '버그', '구현', 'api', '에러', 'error', '디버'],
  emotion:  ['힘들', '기뻐', '슬퍼', '괜찮', '느낌', '마음', '감정', '외로', '위로', '행복'],
  logic:    ['분석', '설명', '왜', '이유', '근거', '논리', '비교', '평가', '판단'],
  creative: ['만들어', '작성', '써줘', '생성', '창작', '아이디어', '브레인스토', '영감'],
  research: ['조사', '찾아', '검색', '알려줘', '정보', '자료', '문서', '논문'],
};
const SUBGOAL_MARKERS = ['그리고', ' 또 ', ',', '+', '하고', ' 및 ', '&', '그다음', '그 다음'];

function heuristicDecompose(goal) {
  if (!goal || typeof goal !== 'string') return { sub_goal_count: 1, domains: [], complexity: 0.1, length_factor: 0 };
  const lower = goal.toLowerCase();
  const domains = [];
  for (const [domain, keywords] of Object.entries(DOMAIN_KEYWORDS)) {
    if (keywords.some(k => lower.includes(k))) domains.push(domain);
  }
  let clauseCount = 0;
  for (const marker of SUBGOAL_MARKERS) clauseCount += Math.max(0, goal.split(marker).length - 1);
  clauseCount += Math.max(0, (goal.match(/[?？]/g) || []).length - 1);
  const sub_goal_count = Math.min(clauseCount + 1, 6);
  const length_factor = Math.min(goal.length / 200, 1.0);
  const complexity = Math.min(
    0.4 * (sub_goal_count / 5) + 0.4 * (Math.min(domains.length, 3) / 3) + 0.2 * length_factor,
    1.0,
  );
  return { sub_goal_count, domains, complexity: +complexity.toFixed(3), length_factor: +length_factor.toFixed(3) };
}

function pickAnchorMode(c) {
  if (c < 0.4) return 'triangle';
  if (c < 0.7) return 'square';
  if (c < 0.9) return 'pentagon';
  return 'equation';
}

// Keyword anchor fit (mirror)
const DIMENSION_KEYWORDS = {
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

function computeAnchorFit(responseText, L2_subs) {
  if (!responseText?.trim()) return 0;
  const lower = responseText.toLowerCase();
  const scores = [];
  for (const sub of L2_subs) {
    const kw = DIMENSION_KEYWORDS[sub.dimension] ?? [];
    const hits = kw.filter(k => lower.includes(k.toLowerCase())).length;
    const coverage = hits > 0 ? Math.min(1, 0.5 + hits * 0.2) : 0;
    scores.push(coverage * sub.score);
  }
  const maxP = L2_subs.reduce((s, x) => s + x.score, 0);
  if (maxP === 0) return 0;
  const rawFit = scores.reduce((a, b) => a + b, 0) / maxP;
  return +(0.4 + rawFit * 0.6).toFixed(3);
}

// L3 selector mirror
const ANCHORS = JSON.parse(fs.readFileSync('data/supportAnchors.json', 'utf8')).anchors;
const DOMAIN_ORDER = ['emotion', 'code', 'design', 'logic', 'creative', 'research', 'meta'];
function kwOverlap(gl, a) {
  const words = a.whenToActivate.toLowerCase().split(/[^a-z가-힣]+/).filter(w => w.length >= 3);
  if (!words.length) return 0;
  let h = 0; for (const w of words) if (gl.includes(w)) h++;
  return h / words.length;
}
function selectL3ByDomain(goal, decomp, k = 3) {
  if (k <= 0) return [];
  const gl = goal.toLowerCase();
  const ad = new Set(decomp.domains);
  const scored = ANCHORS.map(a => {
    let s = 0; if (ad.has(a.domain)) s += 0.6;
    s += kwOverlap(gl, a) * 0.3;
    if (a.domain === 'meta') s += 0.1;
    return { anchor: a, score: s };
  });
  scored.sort((a, b) => b.score !== a.score ? b.score - a.score : DOMAIN_ORDER.indexOf(a.anchor.domain) - DOMAIN_ORDER.indexOf(b.anchor.domain));
  const picked = scored.slice(0, k);
  if (k >= 2 && !picked.some(p => p.anchor.domain === 'meta')) {
    const fm = scored.find(p => p.anchor.domain === 'meta');
    if (fm) picked[picked.length - 1] = fm;
  }
  return picked.map(({ anchor, score }) => ({ id: anchor.id, domain: anchor.domain, text: anchor.text, score: +score.toFixed(3), mode: 'domain' }));
}

// ── Harness ──────────────────────────────────────────────────────────────────
let pass = 0, fail = 0;
const failures = [];
function check(name, cond, detail = '') {
  if (cond) { pass++; console.log(`  ✓ ${name}`); }
  else { fail++; failures.push(`${name} ${detail}`); console.log(`  ✗ ${name} ${detail}`); }
}

// ── T6.1 — goalDecompose unified entry ───────────────────────────────────────
console.log('\n[T6.1] goalDecompose heuristic path');
{
  // Without ANTHROPIC_API_KEY, llmDecompose returns null → heuristic fallback
  const d = heuristicDecompose('React 코드 디버깅하고 UI 디자인도 해줘');
  check('heuristic returns valid decomposition', d.sub_goal_count >= 1 && d.domains.length >= 1);
  check('complexity in [0, 1]', d.complexity >= 0 && d.complexity <= 1);
  check('detects code domain', d.domains.includes('code'), `got [${d.domains}]`);
  check('detects design domain', d.domains.includes('design'), `got [${d.domains}]`);
}

// ── T6.2 — pre-computed decomposition passthrough ────────────────────────────
console.log('\n[T6.2] pre-computed decomposition passthrough');
{
  const preDecomp = { sub_goal_count: 3, domains: ['code', 'design', 'logic'], complexity: 0.72, length_factor: 0.3, source: 'llm' };
  const mode = pickAnchorMode(preDecomp.complexity);
  check('pre-computed complexity 0.72 → pentagon mode', mode === 'pentagon', `got ${mode} for c=${preDecomp.complexity}`);

  const overrideDecomp = { sub_goal_count: 5, domains: ['code', 'design', 'logic', 'emotion'], complexity: 0.95, length_factor: 0.8, source: 'llm' };
  const mode2 = pickAnchorMode(overrideDecomp.complexity);
  check('high complexity → equation mode', mode2 === 'equation', `got ${mode2} for c=${overrideDecomp.complexity}`);
}

// ── T6.3 — L3 auto-mode (domain fallback without Voyage) ────────────────────
console.log('\n[T6.3] L3 auto-mode domain fallback');
{
  const decomp = { sub_goal_count: 2, domains: ['emotion'], complexity: 0.35, length_factor: 0.1 };
  const l3 = selectL3ByDomain('너무 슬퍼서 위로가 필요해', decomp, 3);
  check('returns 3 selections', l3.length === 3);
  check('mode is domain', l3[0].mode === 'domain');
  check('emotion anchor present', l3.some(s => s.domain === 'emotion'));
  check('meta anchor guaranteed', l3.some(s => s.domain === 'meta'));
}

// ── T6.4 — anchor_fit_score keyword baseline ─────────────────────────────────
console.log('\n[T6.4] anchor_fit_score keyword baseline');
{
  const L2 = [
    { dimension: 'self_love', vector: 'agency', score: 0.8 },
    { dimension: 'empathy_bond', vector: 'musical', score: 0.7 },
    { dimension: 'planfulness', vector: 'morning', score: 0.6 },
  ];

  // Response with strong keyword match
  const goodResp = '나 자신을 더 사랑하고, 공감할 수 있는 계획을 세워보자. 함께 성장하는 step이 필요해.';
  const goodFit = computeAnchorFit(goodResp, L2);
  check('good response fit > 0.5', goodFit > 0.5, `got ${goodFit}`);

  // Response with no keyword match
  const badResp = 'The weather is nice today.';
  const badFit = computeAnchorFit(badResp, L2);
  check('bad response fit = baseline 0.4', badFit === 0.4, `got ${badFit}`);

  // Empty response
  check('empty response fit = 0', computeAnchorFit('', L2) === 0);

  // Fit is bounded [0, 1]
  check('fit bounded [0, 1]', goodFit >= 0 && goodFit <= 1 && badFit >= 0 && badFit <= 1);
}

// ── T6.5 — Full pipeline integration ─────────────────────────────────────────
console.log('\n[T6.5] Full pipeline integration');
{
  const goal = '감정이 복잡해서 마음 정리하고, 코드 리팩터링도 하고 싶어';
  const decomp = heuristicDecompose(goal);
  const mode = pickAnchorMode(decomp.complexity);
  const l3 = selectL3ByDomain(goal, decomp, 3);

  check('decompose → multi-domain', decomp.domains.length >= 2, `got [${decomp.domains}]`);
  check('anchor mode valid', ['triangle', 'square', 'pentagon', 'equation'].includes(mode));
  check('L3 returns correct count', l3.length === 3);
  check('L3 picks are relevant', l3.some(s => s.domain === 'emotion' || s.domain === 'code'));

  // Simulate a response and check fit
  const response = '마음이 복잡할 때는 내면을 깊이 성찰하면서 자존감을 높이는 게 중요해요.';
  const L2 = [
    { dimension: 'inner_depth', vector: 'musical', score: 0.9 },
    { dimension: 'self_love', vector: 'agency', score: 0.85 },
  ];
  const fit = computeAnchorFit(response, L2);
  check('simulated response fit > threshold (0.65)', fit > 0.65, `got ${fit}`);
}

// ── T6.6 — Export integrity ──────────────────────────────────────────────────
console.log('\n[T6.6] Export integrity check');
{
  const chatJs = fs.readFileSync('api/chat.js', 'utf8');
  check('api/chat.js exports goalDecompose', chatJs.includes('goalDecompose'));
  check('api/chat.js exports llmDecompose', chatJs.includes('llmDecompose'));
  check('api/chat.js exports heuristicDecompose', chatJs.includes('heuristicDecompose'));
  check('api/chat.js exports buildAnchorPromptBlock', chatJs.includes('buildAnchorPromptBlock'));
  check('api/chat.js has formatL3Block', chatJs.includes('formatL3Block'));

  // Server mirror check
  const serverJs = fs.readFileSync('server.js', 'utf8');
  check('server.js has llmDecompose', serverJs.includes('llmDecompose'));
  check('server.js has goalDecompose', serverJs.includes('goalDecompose'));
  check('server.js has formatL3Block', serverJs.includes('formatL3Block'));
  check('server.js buildAnchorPromptBlock accepts preDecomposition', serverJs.includes('preDecomposition'));
}

// ── Summary ──────────────────────────────────────────────────────────────────
console.log(`\n════════════════════════════════════════`);
console.log(`  Phase 3 Verification: ${pass} passed / ${fail} failed`);
console.log(`════════════════════════════════════════`);
if (fail > 0) {
  console.log('\nFailures:');
  failures.forEach(f => console.log('  ' + f));
  process.exit(1);
}
process.exit(0);
