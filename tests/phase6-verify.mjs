// Phase 6 — Self-Optimizing Harness Tests
// Run: node tests/phase6-verify.mjs
//
// Verifies the self-optimization engine that transitions ARHA Lv4→Lv5:
//   T9.1 — optimizeAnchorConfig: no-op without reliable personalization
//   T9.2 — Weight Adapter: L2 subs adjusted by dim affinities
//   T9.3 — Gravity Scaler: trust-level gravity applied
//   T9.4 — Mode Selector: persona bestMode override
//   T9.5 — Threshold Tuner: adaptive fit thresholds
//   T9.6 — applyOptimization: immutable config transform
//   T9.7 — Optimization directive generation
//   T9.8 — Adaptive thresholds wired into anchorFeedback.ts
//   T9.9 — Pipeline wiring: all endpoints accept anchorOptimizationDirective
//   T9.10 — App.tsx + Dashboard integration

import fs from 'fs';

// ── Inline mirrors ──────────────────────────────────────────────────────

const DEFAULT_FIT_PASS = 0.65;
const DEFAULT_FIT_SOFT = 0.50;
const DEFAULT_FIT_HARD = 0.35;
const MAX_WEIGHT_DELTA = 0.15;
const THRESHOLD_ADAPT_RANGE = 0.08;
const HIGH_CORRECTION_RATE = 0.3;
const LOW_CORRECTION_RATE = 0.05;

function clamp(v, min, max) { return Math.min(max, Math.max(min, v)); }

function computeAdaptiveThresholds(corrRate, totalTurns) {
  if (totalTurns < 20) return { fitPass: DEFAULT_FIT_PASS, fitSoft: DEFAULT_FIT_SOFT, fitHard: DEFAULT_FIT_HARD };
  let adapt = 0;
  if (corrRate > HIGH_CORRECTION_RATE) {
    adapt = -THRESHOLD_ADAPT_RANGE * Math.min(1, (corrRate - HIGH_CORRECTION_RATE) / 0.3);
  } else if (corrRate < LOW_CORRECTION_RATE) {
    adapt = THRESHOLD_ADAPT_RANGE * Math.min(1, (LOW_CORRECTION_RATE - corrRate) / 0.05);
  }
  return {
    fitPass: +clamp(DEFAULT_FIT_PASS + adapt, 0.55, 0.75).toFixed(3),
    fitSoft: +clamp(DEFAULT_FIT_SOFT + adapt, 0.40, 0.60).toFixed(3),
    fitHard: +clamp(DEFAULT_FIT_HARD + adapt, 0.25, 0.45).toFixed(3),
  };
}

function optimizeAnchorConfig(config, personalization, profile) {
  const log = [];
  if (!personalization?.reliable || !profile) {
    return { applied: false, optimizedSubs: config.L2_subs, gravity: 1.0, suggestedMode: null,
      thresholds: { fitPass: DEFAULT_FIT_PASS, fitSoft: DEFAULT_FIT_SOFT, fitHard: DEFAULT_FIT_HARD }, log: [], optimizationDirective: '' };
  }

  const optimizedSubs = config.L2_subs.map(sub => {
    const dimWeight = personalization.dimensionWeights[sub.dimension] ?? 0;
    if (Math.abs(dimWeight) < 0.01) return sub;
    const delta = clamp(dimWeight, -MAX_WEIGHT_DELTA, MAX_WEIGHT_DELTA);
    const newScore = clamp(sub.score + delta, 0.1, 1.0);
    const rounded = +newScore.toFixed(3);
    if (rounded !== sub.score) {
      log.push({ target: `L2.${sub.dimension}`, from: sub.score.toFixed(3), to: rounded.toFixed(3), reason: `dim affinity Δ${dimWeight > 0 ? '+' : ''}${dimWeight.toFixed(3)}` });
    }
    return { ...sub, score: rounded };
  });
  optimizedSubs.sort((a, b) => b.score - a.score);

  const gravity = personalization.gravityMultiplier;
  if (Math.abs(gravity - 1.0) > 0.01) {
    log.push({ target: 'gravity', from: '1.00', to: gravity.toFixed(2), reason: `κ-learned trust level` });
  }

  const suggestedMode = personalization.suggestedMode;
  if (suggestedMode && suggestedMode !== config.mode) {
    log.push({ target: 'mode', from: config.mode, to: suggestedMode, reason: 'persona best-mode' });
  }

  const ps = profile.personaStats?.[config.personaId];
  const thresholds = computeAdaptiveThresholds(ps?.correctionRate ?? 0, ps?.totalTurns ?? 0);
  if (thresholds.fitPass !== DEFAULT_FIT_PASS) {
    log.push({ target: 'threshold.fitPass', from: DEFAULT_FIT_PASS.toFixed(2), to: thresholds.fitPass.toFixed(2), reason: 'adaptive' });
  }

  const changes = log.map(e => `  ${e.target}: ${e.from} → ${e.to} (${e.reason})`).join('\n');
  const optimizationDirective = log.length > 0 ? `## Self-Optimization [Lv5 · ${profile.totalSessions} sessions learned]\nGravity: ${gravity.toFixed(2)}\nAdjustments:\n${changes}` : '';

  return { applied: true, optimizedSubs, gravity, suggestedMode, thresholds, log, optimizationDirective };
}

function applyOptimization(config, result) {
  if (!result.applied) return config;
  return { ...config, L2_subs: result.optimizedSubs, mode: result.suggestedMode ?? config.mode };
}

// ── Test helpers ─────────────────────────────────────────────────────────

let pass = 0, fail = 0;
function assert(condition, label) {
  if (condition) { pass++; console.log(`  ✅ ${label}`); }
  else { fail++; console.error(`  ❌ ${label}`); }
}

// ── Mock factories ───────────────────────────────────────────────────────

function makeConfig(mode = 'square') {
  return {
    personaId: 'tsundere', mode, complexity: 0.5,
    L0: { identityName: 'ARHA', hierarchyNotation: 'L0', antiSycophantic: 'no', driftTolerance: 0.15 },
    L1_main: [{ key: 'V_Agency', score: 0.7, dimensions: 'self_love | social_love | efficacy' }],
    L2_subs: [
      { dimension: 'self_love', vector: 'agency', score: 0.8 },
      { dimension: 'efficacy', vector: 'agency', score: 0.7 },
      { dimension: 'empathy_bond', vector: 'musical', score: 0.6 },
    ],
    L3_support: [],
  };
}

function makePersonalization(reliable, dimWeights = {}, gravity = 1.0, suggestedMode = null) {
  return { dimensionWeights: dimWeights, gravityMultiplier: gravity, suggestedMode, reliable, promptSummary: 'test' };
}

function makeProfile(totalSessions = 5, corrRate = 0.15, totalTurns = 50) {
  return {
    totalSessions,
    dimensionAffinities: {},
    vectorPreferences: {},
    personaStats: { tsundere: { personaId: 'tsundere', sessionCount: totalSessions, avgFit: 0.7, correctionRate: corrRate, totalCorrections: 8, totalTurns, bestMode: 'square', modeFitMap: {} } },
    gravityMultiplier: 1.0,
    optimalSubCount: 3,
  };
}

// ══════════════════════════════════════════════════════════════════════════
// T9.1 — No optimization without reliable personalization
// ══════════════════════════════════════════════════════════════════════════
console.log('\n📋 T9.1 — No-op without reliable personalization');
{
  const cfg = makeConfig();

  const r1 = optimizeAnchorConfig(cfg, null, null);
  assert(r1.applied === false, 'T9.1.1 no personalization → not applied');

  const r2 = optimizeAnchorConfig(cfg, makePersonalization(false), makeProfile());
  assert(r2.applied === false, 'T9.1.2 unreliable personalization → not applied');

  const r3 = optimizeAnchorConfig(cfg, makePersonalization(true), null);
  assert(r3.applied === false, 'T9.1.3 no profile → not applied');
}

// ══════════════════════════════════════════════════════════════════════════
// T9.2 — Weight Adapter
// ══════════════════════════════════════════════════════════════════════════
console.log('\n📋 T9.2 — Weight Adapter: L2 sub adjustment');
{
  const cfg = makeConfig();
  const pers = makePersonalization(true, { self_love: 0.05, efficacy: -0.08 }, 1.0);
  const result = optimizeAnchorConfig(cfg, pers, makeProfile());

  assert(result.applied === true, 'T9.2.1 optimization applied');

  const selfLove = result.optimizedSubs.find(s => s.dimension === 'self_love');
  const efficacy = result.optimizedSubs.find(s => s.dimension === 'efficacy');

  assert(selfLove.score > 0.8, 'T9.2.2 self_love score boosted');
  assert(efficacy.score < 0.7, 'T9.2.3 efficacy score reduced');

  // Check clamping — weight delta should not exceed MAX_WEIGHT_DELTA
  const extreme = makePersonalization(true, { self_love: 0.5 }, 1.0);
  const clamped = optimizeAnchorConfig(cfg, extreme, makeProfile());
  const sl = clamped.optimizedSubs.find(s => s.dimension === 'self_love');
  assert(sl.score <= 0.8 + MAX_WEIGHT_DELTA + 0.001, 'T9.2.4 weight delta clamped to MAX_WEIGHT_DELTA');
}

// ══════════════════════════════════════════════════════════════════════════
// T9.3 — Gravity Scaler
// ══════════════════════════════════════════════════════════════════════════
console.log('\n📋 T9.3 — Gravity Scaler');
{
  const cfg = makeConfig();
  const high = optimizeAnchorConfig(cfg, makePersonalization(true, {}, 1.15), makeProfile());
  assert(high.gravity === 1.15, 'T9.3.1 high trust gravity passed through');

  const low = optimizeAnchorConfig(cfg, makePersonalization(true, {}, 0.85), makeProfile());
  assert(low.gravity === 0.85, 'T9.3.2 low trust gravity passed through');

  assert(high.log.some(e => e.target === 'gravity'), 'T9.3.3 gravity change logged');
}

// ══════════════════════════════════════════════════════════════════════════
// T9.4 — Mode Selector
// ══════════════════════════════════════════════════════════════════════════
console.log('\n📋 T9.4 — Mode Selector');
{
  const cfg = makeConfig('square');
  const result = optimizeAnchorConfig(cfg, makePersonalization(true, {}, 1.0, 'pentagon'), makeProfile());
  assert(result.suggestedMode === 'pentagon', 'T9.4.1 mode override suggested');
  assert(result.log.some(e => e.target === 'mode'), 'T9.4.2 mode change logged');

  // No override when same as current
  const same = optimizeAnchorConfig(cfg, makePersonalization(true, {}, 1.0, 'square'), makeProfile());
  assert(!same.log.some(e => e.target === 'mode'), 'T9.4.3 no log when mode matches');
}

// ══════════════════════════════════════════════════════════════════════════
// T9.5 — Threshold Tuner
// ══════════════════════════════════════════════════════════════════════════
console.log('\n📋 T9.5 — Adaptive Thresholds');
{
  // High correction rate → relaxed (lower) thresholds
  const relaxed = computeAdaptiveThresholds(0.5, 50);
  assert(relaxed.fitPass < DEFAULT_FIT_PASS, 'T9.5.1 high corr rate → lower fitPass');
  assert(relaxed.fitSoft < DEFAULT_FIT_SOFT, 'T9.5.2 high corr rate → lower fitSoft');
  assert(relaxed.fitPass >= 0.55, 'T9.5.3 fitPass within lower bound');

  // Low correction rate → tightened (higher) thresholds
  const tight = computeAdaptiveThresholds(0.01, 50);
  assert(tight.fitPass > DEFAULT_FIT_PASS, 'T9.5.4 low corr rate → higher fitPass');
  assert(tight.fitPass <= 0.75, 'T9.5.5 fitPass within upper bound');

  // Normal correction rate → default thresholds
  const normal = computeAdaptiveThresholds(0.15, 50);
  assert(normal.fitPass === DEFAULT_FIT_PASS, 'T9.5.6 normal rate → default thresholds');

  // Insufficient data → default
  const noData = computeAdaptiveThresholds(0.5, 10);
  assert(noData.fitPass === DEFAULT_FIT_PASS, 'T9.5.7 insufficient turns → default');
}

// ══════════════════════════════════════════════════════════════════════════
// T9.6 — applyOptimization: immutable transform
// ══════════════════════════════════════════════════════════════════════════
console.log('\n📋 T9.6 — applyOptimization');
{
  const cfg = makeConfig('square');
  const result = optimizeAnchorConfig(cfg, makePersonalization(true, { self_love: 0.05 }, 1.1, 'pentagon'), makeProfile());
  const applied = applyOptimization(cfg, result);

  assert(applied !== cfg, 'T9.6.1 new config object (immutable)');
  assert(applied.mode === 'pentagon', 'T9.6.2 mode overridden');
  assert(applied.L2_subs !== cfg.L2_subs, 'T9.6.3 L2_subs replaced');
  assert(cfg.mode === 'square', 'T9.6.4 original config unchanged');

  // No-op case
  const noop = { applied: false, optimizedSubs: cfg.L2_subs, suggestedMode: null };
  assert(applyOptimization(cfg, noop) === cfg, 'T9.6.5 no-op returns same reference');
}

// ══════════════════════════════════════════════════════════════════════════
// T9.7 — Optimization directive
// ══════════════════════════════════════════════════════════════════════════
console.log('\n📋 T9.7 — Optimization directive');
{
  const cfg = makeConfig();
  const result = optimizeAnchorConfig(cfg, makePersonalization(true, { self_love: 0.05 }, 1.1, 'pentagon'), makeProfile());

  assert(result.optimizationDirective.includes('Self-Optimization'), 'T9.7.1 directive has header');
  assert(result.optimizationDirective.includes('Lv5'), 'T9.7.2 directive mentions Lv5');
  assert(result.optimizationDirective.includes('self_love'), 'T9.7.3 directive lists adjusted dimensions');
  assert(result.log.length >= 2, 'T9.7.4 at least 2 log entries (gravity + mode)');
}

// ══════════════════════════════════════════════════════════════════════════
// T9.8 — anchorFeedback.ts adaptive thresholds
// ══════════════════════════════════════════════════════════════════════════
console.log('\n📋 T9.8 — anchorFeedback.ts adaptive threshold support');
{
  const fbTs = fs.readFileSync('services/anchorFeedback.ts', 'utf8');

  assert(fbTs.includes('AdaptiveThresholds'), 'T9.8.1 AdaptiveThresholds type exported');
  assert(fbTs.includes('adaptiveThresholds?: AdaptiveThresholds'), 'T9.8.2 runFeedbackLoop accepts adaptive thresholds');
  assert(fbTs.includes('adaptiveThresholds?.fitPass') || fbTs.includes('adaptiveThresholds?.fitSoft'), 'T9.8.3 thresholds used in drift detection');
  assert(fbTs.includes('thresholdPass') && fbTs.includes('thresholdSoft'), 'T9.8.4 local threshold variables used');
  assert(fbTs.includes('thresholdHard'), 'T9.8.5 hard threshold adapted in correction signal');
}

// ══════════════════════════════════════════════════════════════════════════
// T9.9 — Pipeline wiring
// ══════════════════════════════════════════════════════════════════════════
console.log('\n📋 T9.9 — Pipeline wiring');
{
  const chatJs = fs.readFileSync('api/chat.js', 'utf8');
  const serverJs = fs.readFileSync('server.js', 'utf8');
  const claudeService = fs.readFileSync('services/claudeService.ts', 'utf8');

  assert(chatJs.includes('anchorOptimizationDirective'), 'T9.9.1 api/chat.js has optimization directive');
  assert(serverJs.includes('anchorOptimizationDirective'), 'T9.9.2 server.js has optimization directive');
  assert(claudeService.includes('anchorOptimizationDirective'), 'T9.9.3 claudeService has optimization directive');
  assert(chatJs.includes('Self-optimization directive injected'), 'T9.9.4 api/chat.js logs optimization');
  assert(serverJs.includes('parts.push(anchorOptimizationDirective)'), 'T9.9.5 server.js pushes directive');
}

// ══════════════════════════════════════════════════════════════════════════
// T9.10 — App.tsx + Dashboard integration
// ══════════════════════════════════════════════════════════════════════════
console.log('\n📋 T9.10 — App.tsx + Dashboard integration');
{
  const appTsx = fs.readFileSync('App.tsx', 'utf8');
  const dashboard = fs.readFileSync('components/EmotionalDashboard.tsx', 'utf8');

  assert(appTsx.includes('optimizeAnchorConfig'), 'T9.10.1 App imports optimizeAnchorConfig');
  assert(appTsx.includes('applyOptimization'), 'T9.10.2 App imports applyOptimization');
  assert(appTsx.includes('lastOptimization'), 'T9.10.3 App has optimization state');
  assert(appTsx.includes('optimizationDirective'), 'T9.10.4 App passes directive to service');
  assert(appTsx.includes('optimizationResult={lastOptimization}'), 'T9.10.5 App passes result to dashboard');

  assert(dashboard.includes('OptimizationResult'), 'T9.10.6 Dashboard imports OptimizationResult');
  assert(dashboard.includes('optimizationResult'), 'T9.10.7 Dashboard has optimization prop');
  assert(dashboard.includes('Self-Optimization'), 'T9.10.8 Dashboard renders optimization panel');
  assert(dashboard.includes('Lv5'), 'T9.10.9 Dashboard shows Lv5 label');
  assert(dashboard.includes('optimizationResult.log'), 'T9.10.10 Dashboard renders log entries');
}

// ══════════════════════════════════════════════════════════════════════════
// T9.11 — anchorOptimizer.ts module integrity
// ══════════════════════════════════════════════════════════════════════════
console.log('\n📋 T9.11 — anchorOptimizer.ts module integrity');
{
  const src = fs.readFileSync('services/anchorOptimizer.ts', 'utf8');

  assert(src.includes('export function optimizeAnchorConfig'), 'T9.11.1 optimizeAnchorConfig exported');
  assert(src.includes('export function applyOptimization'), 'T9.11.2 applyOptimization exported');
  assert(src.includes('OptimizationResult'), 'T9.11.3 OptimizationResult type');
  assert(src.includes('OptimizedThresholds'), 'T9.11.4 OptimizedThresholds type');
  assert(src.includes('OptimizationLogEntry'), 'T9.11.5 OptimizationLogEntry type');
  assert(src.includes('computeAdaptiveThresholds'), 'T9.11.6 adaptive threshold computation');
  assert(src.includes('buildOptimizationDirective'), 'T9.11.7 directive builder');
}

// ══════════════════════════════════════════════════════════════════════════
// Summary
// ══════════════════════════════════════════════════════════════════════════
console.log(`\n${'═'.repeat(60)}`);
console.log(`Phase 6 Verification: ${pass} passed, ${fail} failed out of ${pass + fail}`);
console.log('═'.repeat(60));
if (fail > 0) process.exit(1);
