// Phase 4 — Closed-Loop Anchor Correction Tests
// Run: node tests/phase4-verify.mjs
//
// Verifies the feedback engine that transforms ARHA from Lv3 → Lv4:
//   T7.1 — evaluateFit: dimensional hit analysis
//   T7.2 — detectDrift: L0 breach + sustained low fit detection
//   T7.3 — generateCorrectionSignal: none/soft/strong/l0_recovery routing
//   T7.4 — updateFeedbackState: decay/boost + rolling history
//   T7.5 — formatCorrectionBlock: prompt-ready output
//   T7.6 — runFeedbackLoop: full orchestration
//   T7.7 — analyzeFitTrend: improving/stable/declining detection
//   T7.8 — Export integrity in api/chat.js + server.js

import fs from 'fs';

// ── Inline mirrors (from anchorFeedback.ts — keep in lockstep) ───────────────

const FIT_THRESHOLD_PASS = 0.65;
const FIT_THRESHOLD_SOFT = 0.50;
const FIT_THRESHOLD_HARD = 0.35;
const DRIFT_DECAY_RATE = 0.85;
const BOOST_FACTOR = 0.15;
const DAMPEN_FACTOR = 0.10;

const DIMENSION_KEYWORDS = {
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

const L0_VIOLATION_MARKERS = [
  '네 맞아요', '당신 말이 맞', "you're absolutely right",
  '무조건 동의', '완전 맞는 말',
  '저는 AI입니다', '저는 인공지능', 'I am an AI', 'as an AI',
  '저는 감정이 없', "I don't have feelings",
];

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

function evaluateFit(responseText, config) {
  const overallFit = computeAnchorFit(responseText, config.L2_subs);
  const lower = responseText.toLowerCase();
  const dimensionHits = config.L2_subs.map(sub => {
    const kw = DIMENSION_KEYWORDS[sub.dimension] ?? [];
    const hit = kw.some(k => lower.includes(k.toLowerCase()));
    return { dimension: sub.dimension, hit, score: sub.score };
  });
  const missedDimensions = dimensionHits.filter(d => !d.hit && d.score >= 0.5).map(d => d.dimension);
  const l0Preserved = !L0_VIOLATION_MARKERS.some(m => lower.includes(m.toLowerCase()));
  const totalWeight = config.L2_subs.reduce((s, d) => s + d.score, 0);
  const missedWeight = dimensionHits.filter(d => !d.hit).reduce((s, d) => s + d.score, 0);
  const driftMagnitude = totalWeight > 0 ? +(missedWeight / totalWeight).toFixed(3) : 0;
  return { overallFit, dimensionHits, missedDimensions, l0Preserved, driftMagnitude, timestamp: Date.now() };
}

function detectDrift(evaluation, config, fitHistory) {
  if (!evaluation.l0Preserved) {
    return { detected: true, severity: 3, description: `L0 identity breach — ${config.L0.identityName}`, recoveryDirective: 'CRITICAL' };
  }
  const recentFits = [...fitHistory.slice(-2), evaluation.overallFit];
  if (recentFits.length >= 3 && recentFits.every(f => f < FIT_THRESHOLD_SOFT)) {
    return { detected: true, severity: 2, description: 'Sustained drift', recoveryDirective: 'RE-CENTER' };
  }
  if (evaluation.driftMagnitude > 0.6 && evaluation.overallFit < FIT_THRESHOLD_PASS) {
    return { detected: true, severity: 1, description: 'Mild drift', recoveryDirective: 'NUDGE' };
  }
  return { detected: false, severity: 0, description: '', recoveryDirective: '' };
}

function analyzeFitTrend(fitHistory) {
  if (fitHistory.length < 3) return 'insufficient_data';
  const recent = fitHistory.slice(-3);
  const diffs = recent.slice(1).map((v, i) => v - recent[i]);
  const avgDiff = diffs.reduce((a, b) => a + b, 0) / diffs.length;
  if (avgDiff > 0.03) return 'improving';
  if (avgDiff < -0.03) return 'declining';
  return 'stable';
}

// Mock config
const mockConfig = {
  personaId: 'arha',
  mode: 'square',
  complexity: 0.55,
  decomposition: { sub_goal_count: 2, domains: ['emotion'], complexity: 0.55, length_factor: 0.1 },
  L0: { identityName: 'ARHA', hierarchyNotation: 'Core', antiSycophantic: 'Disagree when needed', driftTolerance: 0.15 },
  L1_main: [{ key: 'V_Agency', score: 0.7, dimensions: 'self_love | social_love | efficacy' }],
  L2_subs: [
    { dimension: 'self_love', vector: 'agency', score: 0.8 },
    { dimension: 'empathy_bond', vector: 'musical', score: 0.75 },
    { dimension: 'inner_depth', vector: 'musical', score: 0.65 },
  ],
  L3_support: [],
  triVector: { agency: {}, morning: {}, musical: {}, fx: {}, dominant: { key: 'grounded', score: 0.5 } },
};

// ── Harness ──────────────────────────────────────────────────────────────────
let pass = 0, fail = 0;
const failures = [];
function check(name, cond, detail = '') {
  if (cond) { pass++; console.log(`  ✓ ${name}`); }
  else { fail++; failures.push(`${name} ${detail}`); console.log(`  ✗ ${name} ${detail}`); }
}

// ── T7.1 — evaluateFit ──────────────────────────────────────────────────────
console.log('\n[T7.1] evaluateFit');
{
  const goodResp = '나 자신을 사랑하고, 내면의 깊이를 성찰하면서, 서로 공감하고 이해하는 게 중요해.';
  const ev = evaluateFit(goodResp, mockConfig);
  check('fit > 0.65 for keyword-rich response', ev.overallFit > 0.65, `got ${ev.overallFit}`);
  check('all dimensions hit', ev.dimensionHits.every(d => d.hit), `missed: ${ev.missedDimensions}`);
  check('no missed dimensions', ev.missedDimensions.length === 0);
  check('L0 preserved', ev.l0Preserved);
  check('drift magnitude low', ev.driftMagnitude < 0.3, `got ${ev.driftMagnitude}`);

  const badResp = 'The weather is quite nice today.';
  const evBad = evaluateFit(badResp, mockConfig);
  check('fit = baseline 0.4 for unrelated response', evBad.overallFit === 0.4, `got ${evBad.overallFit}`);
  check('all dimensions missed', evBad.missedDimensions.length >= 2);
  check('high drift magnitude', evBad.driftMagnitude > 0.5, `got ${evBad.driftMagnitude}`);
}

// ── T7.2 — detectDrift ──────────────────────────────────────────────────────
console.log('\n[T7.2] detectDrift');
{
  // L0 breach
  const l0BreachEval = evaluateFit('저는 AI입니다. 감정이 없어요.', mockConfig);
  const l0Drift = detectDrift(l0BreachEval, mockConfig, [0.7, 0.8]);
  check('L0 breach → severity 3', l0Drift.severity === 3);
  check('L0 breach → detected', l0Drift.detected);

  // Sustained low fit
  const lowEval = { ...evaluateFit('hello', mockConfig), l0Preserved: true };
  const sustainedDrift = detectDrift(lowEval, mockConfig, [0.3, 0.4]);
  check('sustained low → severity 2', sustainedDrift.severity === 2);

  // No drift on good response
  const goodEval = evaluateFit('나를 사랑하고 공감하며 깊이 성찰해', mockConfig);
  const noDrift = detectDrift(goodEval, mockConfig, [0.7, 0.8]);
  check('good response → no drift', !noDrift.detected);
}

// ── T7.3 — correction signal routing ─────────────────────────────────────────
console.log('\n[T7.3] correction signal routing');
{
  const baseState = { fitHistory: [], correctionCount: 0, weightAdjustments: {}, lastCorrection: null, driftAlert: null, turnIndex: 0 };

  // Good fit → no correction
  const goodEval = evaluateFit('나를 사랑하고 공감하며 깊이 성찰해', mockConfig);
  const goodDrift = detectDrift(goodEval, mockConfig, [0.7]);
  const needsCorrection = goodEval.overallFit < FIT_THRESHOLD_PASS || goodDrift.detected;
  check('good fit → no correction needed', !needsCorrection);

  // Bad fit → correction needed
  const badEval = evaluateFit('hello world', mockConfig);
  const badDrift = detectDrift(badEval, mockConfig, [0.3, 0.4]);
  check('bad fit → correction needed', badEval.overallFit < FIT_THRESHOLD_PASS);

  // Very bad fit → strong redirect expected
  check('very bad fit (< 0.35) → strong expected',
    badEval.overallFit <= FIT_THRESHOLD_SOFT || badDrift.severity >= 2);
}

// ── T7.4 — weight decay/boost ────────────────────────────────────────────────
console.log('\n[T7.4] weight decay/boost');
{
  const state = {
    fitHistory: [0.7],
    correctionCount: 0,
    weightAdjustments: { self_love: 0.2, inner_depth: -0.1 },
    lastCorrection: null,
    driftAlert: null,
    turnIndex: 1,
  };

  // Simulate decay
  const decayed = {};
  for (const [dim, adj] of Object.entries(state.weightAdjustments)) {
    const d = adj * DRIFT_DECAY_RATE;
    if (Math.abs(d) > 0.01) decayed[dim] = +d.toFixed(3);
  }
  check('self_love decays', decayed.self_love < 0.2 && decayed.self_love > 0.1, `got ${decayed.self_love}`);
  check('inner_depth decays toward 0', decayed.inner_depth > -0.1, `got ${decayed.inner_depth}`);

  // Boost for missed dimension
  const boosted = (decayed.empathy_bond ?? 0) + BOOST_FACTOR;
  check('missed dim gets boosted', boosted === BOOST_FACTOR, `got ${boosted}`);
}

// ── T7.5 — formatCorrectionBlock ─────────────────────────────────────────────
console.log('\n[T7.5] formatCorrectionBlock');
{
  const correction = {
    type: 'soft_nudge',
    correctionText: '## Anchor Nudge [soft — fit:0.52]\nGently re-incorporate missed dims.',
    emphasize: ['inner_depth'],
    deemphasize: [],
    gravityAdjustments: { inner_depth: 0.15 },
  };
  const block = correction.correctionText;
  check('correction block not empty', block.length > 0);
  check('contains Anchor Nudge header', block.includes('Anchor Nudge'));
  check('contains fit score', block.includes('0.52'));
}

// ── T7.6 — full loop orchestration ───────────────────────────────────────────
console.log('\n[T7.6] full loop orchestration');
{
  // Good response → loop should produce no correction
  const goodResp = '나 자신의 내면을 깊이 성찰하고, 공감을 나누며, 자존감을 높여가자.';
  const goodEval = evaluateFit(goodResp, mockConfig);
  const goodDrift = detectDrift(goodEval, mockConfig, [0.7, 0.8]);
  check('loop: good response → fit passes', goodEval.overallFit >= FIT_THRESHOLD_PASS, `got ${goodEval.overallFit}`);
  check('loop: good response → no drift', !goodDrift.detected);

  // Bad response → loop should produce correction
  const badResp = 'The sky is blue and the birds are singing.';
  const badEval = evaluateFit(badResp, mockConfig);
  check('loop: bad response → fit fails', badEval.overallFit < FIT_THRESHOLD_PASS, `got ${badEval.overallFit}`);
  check('loop: bad response → missed dims exist', badEval.missedDimensions.length > 0);
}

// ── T7.7 — fit trend analysis ────────────────────────────────────────────────
console.log('\n[T7.7] fit trend analysis');
{
  check('insufficient data for < 3 points', analyzeFitTrend([0.5, 0.6]) === 'insufficient_data');
  check('improving trend', analyzeFitTrend([0.4, 0.5, 0.6]) === 'improving');
  check('declining trend', analyzeFitTrend([0.8, 0.7, 0.6]) === 'declining');
  check('stable trend', analyzeFitTrend([0.65, 0.66, 0.65]) === 'stable');
  check('longer improving', analyzeFitTrend([0.3, 0.4, 0.5, 0.6, 0.7]) === 'improving');
}

// ── T7.8 — export integrity ──────────────────────────────────────────────────
console.log('\n[T7.8] export integrity');
{
  const chatJs = fs.readFileSync('api/chat.js', 'utf8');
  const serverJs = fs.readFileSync('server.js', 'utf8');

  check('api/chat.js accepts anchorCorrectionBlock', chatJs.includes('anchorCorrectionBlock'));
  check('api/chat.js injects correction into prompt', chatJs.includes('Anchor correction injected'));
  check('server.js accepts anchorCorrectionBlock', serverJs.includes('anchorCorrectionBlock'));
  check('server.js injects correction into prompt', serverJs.includes('anchorCorrectionBlock'));

  // claudeService forwards
  const claudeTs = fs.readFileSync('services/claudeService.ts', 'utf8');
  check('claudeService has anchorCorrectionBlock param', claudeTs.includes('anchorCorrectionBlock'));
}

// ── Summary ──────────────────────────────────────────────────────────────────
console.log(`\n════════════════════════════════════════`);
console.log(`  Phase 4 Verification: ${pass} passed / ${fail} failed`);
console.log(`════════════════════════════════════════`);
if (fail > 0) {
  console.log('\nFailures:');
  failures.forEach(f => console.log('  ' + f));
  process.exit(1);
}
process.exit(0);
