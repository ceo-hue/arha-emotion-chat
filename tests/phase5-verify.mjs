// Phase 5 — Cross-Session Personalization Tests
// Run: node tests/phase5-verify.mjs
//
// Verifies the user anchor profile learning engine:
//   T8.1 — createInitialAnchorProfile: correct initial state
//   T8.2 — learnFromSession: EMA blending, dimension affinity, vector preference
//   T8.3 — learnFromSession: persona stats + mode tracking
//   T8.4 — learnFromSession: gravity multiplier from kappa
//   T8.5 — getPersonalization: unreliable below MIN_SESSIONS
//   T8.6 — getPersonalization: reliable output with dim weights + mode suggestion
//   T8.7 — Multi-session learning convergence (5 sessions)
//   T8.8 — Pipeline wiring: claudeService, api/chat.js, server.js accept anchorPersonalizationPrompt
//   T8.9 — App.tsx integration: imports + state + session-end wiring

import fs from 'fs';

// ── Inline mirrors (from userAnchorProfile.ts) ────────────────────────────

const ANCHOR_PROFILE_ALPHA = 0.2;
const GRAVITY_BASE = 1.0;
const GRAVITY_MIN = 0.8;
const GRAVITY_MAX = 1.2;
const MIN_SESSIONS_FOR_LEARNING = 3;

const ALL_DIMENSIONS = [
  'self_love', 'social_love', 'efficacy',
  'planfulness', 'brightness', 'challenge',
  'musical_sense', 'inner_depth', 'empathy_bond',
];

const ALL_L1_VECTORS = ['V_Agency', 'V_Morning', 'V_Musical'];

function ema(prev, next, alpha) {
  return +(alpha * next + (1 - alpha) * prev).toFixed(4);
}

function clamp(v, min, max) {
  return Math.min(max, Math.max(min, v));
}

// ── Minimal profile factory ──────────────────────────────────────────────

function createInitialAnchorProfile() {
  const dimensionAffinities = {};
  for (const dim of ALL_DIMENSIONS) {
    dimensionAffinities[dim] = { dimension: dim, affinity: 0.5, exposures: 0, hits: 0 };
  }
  const vectorPreferences = {};
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

// ── Minimal learnFromSession mirror ──────────────────────────────────────

function learnFromSession(profile, input) {
  const { personaId, anchorConfig, feedbackState, fitEvaluations, kappaEnd } = input;
  const updated = JSON.parse(JSON.stringify(profile));

  if (fitEvaluations.length === 0) return updated;

  const sessionAvgFit = fitEvaluations.reduce((s, e) => s + e.overallFit, 0) / fitEvaluations.length;
  const sessionCorrectionRate = feedbackState.correctionCount / Math.max(feedbackState.turnIndex, 1);

  // Dimension affinities
  for (const evalItem of fitEvaluations) {
    for (const dimHit of evalItem.dimensionHits) {
      const aff = updated.dimensionAffinities[dimHit.dimension];
      if (!aff) continue;
      aff.exposures++;
      if (dimHit.hit) {
        aff.hits++;
        if (evalItem.overallFit >= 0.65) {
          aff.affinity = ema(aff.affinity, Math.min(1, aff.affinity + 0.05), ANCHOR_PROFILE_ALPHA);
        }
      } else {
        aff.affinity = ema(aff.affinity, Math.max(0, aff.affinity - 0.02), ANCHOR_PROFILE_ALPHA);
      }
    }
  }

  // Vector preferences
  for (const l1 of anchorConfig.L1_main) {
    const pref = updated.vectorPreferences[l1.key];
    if (!pref) continue;
    pref.sessionCount++;
    pref.avgFit = ema(pref.avgFit, sessionAvgFit, ANCHOR_PROFILE_ALPHA);
    pref.preference = ema(pref.preference, sessionAvgFit, ANCHOR_PROFILE_ALPHA);
  }

  // Persona stats
  if (!updated.personaStats[personaId]) {
    updated.personaStats[personaId] = {
      personaId, sessionCount: 0, avgFit: 0.5, correctionRate: 0,
      totalCorrections: 0, totalTurns: 0, bestMode: null, modeFitMap: {},
    };
  }
  const ps = updated.personaStats[personaId];
  ps.sessionCount++;
  ps.avgFit = ema(ps.avgFit, sessionAvgFit, ANCHOR_PROFILE_ALPHA);
  ps.correctionRate = ema(ps.correctionRate, sessionCorrectionRate, ANCHOR_PROFILE_ALPHA);
  ps.totalCorrections += feedbackState.correctionCount;
  ps.totalTurns += feedbackState.turnIndex;

  const mode = anchorConfig.mode;
  if (!ps.modeFitMap[mode]) ps.modeFitMap[mode] = { totalFit: 0, count: 0 };
  ps.modeFitMap[mode].totalFit += sessionAvgFit;
  ps.modeFitMap[mode].count++;

  let bestModeFit = -1;
  for (const [m, data] of Object.entries(ps.modeFitMap)) {
    if (!data || data.count < 2) continue;
    const avg = data.totalFit / data.count;
    if (avg > bestModeFit) { bestModeFit = avg; ps.bestMode = m; }
  }

  // Gravity
  const kappaGravity = GRAVITY_MIN + (GRAVITY_MAX - GRAVITY_MIN) * kappaEnd;
  updated.gravityMultiplier = ema(updated.gravityMultiplier, kappaGravity, ANCHOR_PROFILE_ALPHA);
  updated.gravityMultiplier = clamp(updated.gravityMultiplier, GRAVITY_MIN, GRAVITY_MAX);

  updated.totalSessions++;
  return updated;
}

// ── getPersonalization mirror ────────────────────────────────────────────

function getPersonalization(profile, personaId) {
  const reliable = profile.totalSessions >= MIN_SESSIONS_FOR_LEARNING;

  if (!reliable) {
    return { dimensionWeights: {}, gravityMultiplier: GRAVITY_BASE, suggestedMode: null, reliable: false, promptSummary: '' };
  }

  const dimensionWeights = {};
  for (const [dim, aff] of Object.entries(profile.dimensionAffinities)) {
    if (aff.exposures < 5) continue;
    const deviation = aff.affinity - 0.5;
    if (Math.abs(deviation) > 0.1) {
      dimensionWeights[dim] = +(deviation * 0.2).toFixed(3);
    }
  }

  const ps = profile.personaStats[personaId];
  const suggestedMode = ps?.bestMode ?? null;

  const topDims = Object.entries(profile.dimensionAffinities)
    .sort((a, b) => b[1].affinity - a[1].affinity)
    .slice(0, 3)
    .map(([dim, aff]) => `${dim}(${aff.affinity.toFixed(2)})`);

  const topVec = Object.entries(profile.vectorPreferences)
    .sort((a, b) => b[1].preference - a[1].preference)
    .map(([, pref]) => `${pref.vector}(${pref.preference.toFixed(2)})`);

  const promptSummary = `## User Anchor Profile [learned · sessions:${profile.totalSessions}]\nGravity: ${profile.gravityMultiplier.toFixed(2)} | Optimal subs: ${profile.optimalSubCount}\nTop dimensions: ${topDims.join(', ')}\nVector preference: ${topVec.join(' > ')}\n${ps ? `Persona ${personaId}: avgFit=${ps.avgFit.toFixed(2)}, corrRate=${ps.correctionRate.toFixed(2)}${suggestedMode ? `, bestMode=${suggestedMode}` : ''}` : ''}\nApply dimension weights to L2 sub scoring — boost high-affinity, reduce low-affinity.`;

  return { dimensionWeights, gravityMultiplier: profile.gravityMultiplier, suggestedMode, reliable, promptSummary };
}

// ── Test helpers ─────────────────────────────────────────────────────────

let pass = 0, fail = 0;
function assert(condition, label) {
  if (condition) { pass++; console.log(`  ✅ ${label}`); }
  else { fail++; console.error(`  ❌ ${label}`); }
}

// ── Mock data factories ──────────────────────────────────────────────────

function makeFitEval(overallFit, hitDims = [], allDims = ['self_love', 'efficacy', 'empathy_bond']) {
  return {
    overallFit,
    dimensionHits: allDims.map(d => ({ dimension: d, hit: hitDims.includes(d), score: 0.7 })),
    missedDimensions: allDims.filter(d => !hitDims.includes(d)),
    l0Preserved: true,
    driftMagnitude: 0.2,
    timestamp: Date.now(),
  };
}

function makeAnchorConfig(mode = 'square') {
  return {
    personaId: 'tsundere',
    mode,
    complexity: 0.5,
    decomposition: { sub_goal_count: 2, domains: ['emotion'], complexity: 0.5, length_factor: 0.3 },
    L0: { identityName: 'ARHA-Core', hierarchyNotation: 'L0::Core', antiSycophantic: 'no', driftTolerance: 0.15 },
    L1_main: [{ key: 'V_Agency', score: 0.7, dimensions: 'self_love | social_love | efficacy' }],
    L2_subs: [
      { dimension: 'self_love', vector: 'agency', score: 0.8 },
      { dimension: 'efficacy', vector: 'agency', score: 0.7 },
      { dimension: 'empathy_bond', vector: 'musical', score: 0.65 },
    ],
    L3_support: [],
    triVector: { agency: {}, morning: {}, musical: {}, fx: {}, dominant: { key: 'achievement', score: 0.7 } },
  };
}

function makeFeedbackState(turnIndex = 5, correctionCount = 1) {
  return {
    fitHistory: [0.6, 0.65, 0.7, 0.68, 0.72],
    correctionCount,
    weightAdjustments: {},
    lastCorrection: null,
    driftAlert: null,
    turnIndex,
  };
}

// ══════════════════════════════════════════════════════════════════════════
// T8.1 — createInitialAnchorProfile
// ══════════════════════════════════════════════════════════════════════════
console.log('\n📋 T8.1 — createInitialAnchorProfile');
{
  const p = createInitialAnchorProfile();
  assert(Object.keys(p.dimensionAffinities).length === 9, 'T8.1.1 has all 9 dimensions');
  assert(Object.keys(p.vectorPreferences).length === 3, 'T8.1.2 has all 3 L1 vectors');
  assert(p.gravityMultiplier === 1.0, 'T8.1.3 gravity starts at 1.0');
  assert(p.totalSessions === 0, 'T8.1.4 starts with 0 sessions');
  assert(p.dimensionAffinities.self_love.affinity === 0.5, 'T8.1.5 affinity starts at 0.5');
  assert(p.vectorPreferences.V_Agency.preference === 0.5, 'T8.1.6 vector preference starts at 0.5');
}

// ══════════════════════════════════════════════════════════════════════════
// T8.2 — learnFromSession: EMA blending
// ══════════════════════════════════════════════════════════════════════════
console.log('\n📋 T8.2 — learnFromSession: EMA dimension + vector learning');
{
  const profile = createInitialAnchorProfile();
  const evals = [
    makeFitEval(0.72, ['self_love', 'efficacy']),
    makeFitEval(0.68, ['self_love', 'empathy_bond']),
  ];
  const result = learnFromSession(profile, {
    personaId: 'tsundere',
    anchorConfig: makeAnchorConfig(),
    feedbackState: makeFeedbackState(),
    fitEvaluations: evals,
    kappaEnd: 0.6,
  });

  assert(result.totalSessions === 1, 'T8.2.1 session count incremented');
  assert(result.dimensionAffinities.self_love.exposures === 2, 'T8.2.2 self_love exposed 2x');
  assert(result.dimensionAffinities.self_love.hits === 2, 'T8.2.3 self_love hit 2x');
  assert(result.dimensionAffinities.self_love.affinity > 0.5, 'T8.2.4 self_love affinity increased');
  assert(result.dimensionAffinities.empathy_bond.affinity !== profile.dimensionAffinities.empathy_bond.affinity, 'T8.2.5 empathy_bond affinity changed');
  assert(result.vectorPreferences.V_Agency.sessionCount === 1, 'T8.2.6 V_Agency session count');
  assert(result.vectorPreferences.V_Agency.preference !== 0.5, 'T8.2.7 V_Agency preference updated via EMA');
}

// ══════════════════════════════════════════════════════════════════════════
// T8.3 — learnFromSession: persona stats + mode tracking
// ══════════════════════════════════════════════════════════════════════════
console.log('\n📋 T8.3 — learnFromSession: persona stats');
{
  const profile = createInitialAnchorProfile();
  const evals = [makeFitEval(0.75, ['self_love', 'efficacy', 'empathy_bond'])];
  const result = learnFromSession(profile, {
    personaId: 'cool',
    anchorConfig: makeAnchorConfig('pentagon'),
    feedbackState: makeFeedbackState(10, 2),
    fitEvaluations: evals,
    kappaEnd: 0.8,
  });

  const ps = result.personaStats.cool;
  assert(ps !== undefined, 'T8.3.1 persona stats created');
  assert(ps.sessionCount === 1, 'T8.3.2 session count = 1');
  assert(ps.avgFit !== 0.5, 'T8.3.3 avgFit updated from default');
  assert(ps.totalTurns === 10, 'T8.3.4 totalTurns accumulated');
  assert(ps.totalCorrections === 2, 'T8.3.5 totalCorrections accumulated');
  assert(ps.modeFitMap.pentagon !== undefined, 'T8.3.6 mode pentagon tracked');
  assert(ps.modeFitMap.pentagon.count === 1, 'T8.3.7 pentagon count = 1');
  assert(ps.bestMode === null, 'T8.3.8 bestMode null (need 2+ sessions per mode)');
}

// ══════════════════════════════════════════════════════════════════════════
// T8.4 — learnFromSession: gravity from kappa
// ══════════════════════════════════════════════════════════════════════════
console.log('\n📋 T8.4 — gravity multiplier from kappa');
{
  const profile = createInitialAnchorProfile();
  const evals = [makeFitEval(0.7, ['self_love'])];

  // High kappa → gravity should move toward 1.2
  const highK = learnFromSession(profile, {
    personaId: 'tsundere', anchorConfig: makeAnchorConfig(),
    feedbackState: makeFeedbackState(), fitEvaluations: evals, kappaEnd: 1.0,
  });
  assert(highK.gravityMultiplier > 1.0, 'T8.4.1 high kappa → gravity > 1.0');

  // Low kappa → gravity should move toward 0.8
  const lowK = learnFromSession(profile, {
    personaId: 'tsundere', anchorConfig: makeAnchorConfig(),
    feedbackState: makeFeedbackState(), fitEvaluations: evals, kappaEnd: 0.0,
  });
  assert(lowK.gravityMultiplier < 1.0, 'T8.4.2 low kappa → gravity < 1.0');

  // Bounds check
  assert(highK.gravityMultiplier <= GRAVITY_MAX, 'T8.4.3 gravity ≤ 1.2');
  assert(lowK.gravityMultiplier >= GRAVITY_MIN, 'T8.4.4 gravity ≥ 0.8');
}

// ══════════════════════════════════════════════════════════════════════════
// T8.5 — getPersonalization: unreliable below MIN_SESSIONS
// ══════════════════════════════════════════════════════════════════════════
console.log('\n📋 T8.5 — getPersonalization: unreliable below threshold');
{
  const profile = createInitialAnchorProfile();
  profile.totalSessions = 2; // Below MIN_SESSIONS_FOR_LEARNING = 3

  const p = getPersonalization(profile, 'tsundere');
  assert(p.reliable === false, 'T8.5.1 not reliable with 2 sessions');
  assert(Object.keys(p.dimensionWeights).length === 0, 'T8.5.2 no dimension weights');
  assert(p.gravityMultiplier === GRAVITY_BASE, 'T8.5.3 default gravity');
  assert(p.suggestedMode === null, 'T8.5.4 no suggested mode');
  assert(p.promptSummary === '', 'T8.5.5 empty prompt summary');
}

// ══════════════════════════════════════════════════════════════════════════
// T8.6 — getPersonalization: reliable with learned data
// ══════════════════════════════════════════════════════════════════════════
console.log('\n📋 T8.6 — getPersonalization: reliable output');
{
  const profile = createInitialAnchorProfile();
  profile.totalSessions = 5;
  profile.gravityMultiplier = 1.1;
  profile.dimensionAffinities.self_love = { dimension: 'self_love', affinity: 0.75, exposures: 10, hits: 8 };
  profile.dimensionAffinities.efficacy = { dimension: 'efficacy', affinity: 0.3, exposures: 10, hits: 3 };
  profile.personaStats.tsundere = {
    personaId: 'tsundere', sessionCount: 5, avgFit: 0.72, correctionRate: 0.1,
    totalCorrections: 5, totalTurns: 50, bestMode: 'square',
    modeFitMap: { square: { totalFit: 3.6, count: 5 } },
  };

  const p = getPersonalization(profile, 'tsundere');
  assert(p.reliable === true, 'T8.6.1 reliable with 5 sessions');
  assert(p.dimensionWeights.self_love > 0, 'T8.6.2 self_love weight positive (high affinity)');
  assert(p.dimensionWeights.efficacy < 0, 'T8.6.3 efficacy weight negative (low affinity)');
  assert(p.gravityMultiplier === 1.1, 'T8.6.4 gravity from profile');
  assert(p.suggestedMode === 'square', 'T8.6.5 suggested mode from persona bestMode');
  assert(p.promptSummary.includes('User Anchor Profile'), 'T8.6.6 prompt summary has header');
  assert(p.promptSummary.includes('sessions:5'), 'T8.6.7 prompt summary has session count');
  assert(p.promptSummary.includes('self_love'), 'T8.6.8 prompt summary has top dimension');
}

// ══════════════════════════════════════════════════════════════════════════
// T8.7 — Multi-session learning convergence
// ══════════════════════════════════════════════════════════════════════════
console.log('\n📋 T8.7 — Multi-session convergence (5 sessions)');
{
  let profile = createInitialAnchorProfile();

  // Simulate 5 sessions with consistent high fit on self_love + efficacy
  for (let i = 0; i < 5; i++) {
    const evals = [
      makeFitEval(0.75, ['self_love', 'efficacy']),
      makeFitEval(0.72, ['self_love', 'efficacy', 'empathy_bond']),
    ];
    profile = learnFromSession(profile, {
      personaId: 'tsundere',
      anchorConfig: makeAnchorConfig('square'),
      feedbackState: makeFeedbackState(8, 1),
      fitEvaluations: evals,
      kappaEnd: 0.7,
    });
  }

  assert(profile.totalSessions === 5, 'T8.7.1 5 sessions recorded');
  assert(profile.dimensionAffinities.self_love.affinity > 0.5, 'T8.7.2 self_love affinity grew (consistent hits)');
  assert(profile.dimensionAffinities.self_love.hits >= 10, 'T8.7.3 self_love accumulated 10+ hits');
  assert(profile.vectorPreferences.V_Agency.sessionCount === 5, 'T8.7.4 V_Agency 5 sessions');

  const ps = profile.personaStats.tsundere;
  assert(ps.sessionCount === 5, 'T8.7.5 persona 5 sessions');
  assert(ps.modeFitMap.square.count === 5, 'T8.7.6 square mode 5 counts');

  // Personalization should now be reliable
  const p = getPersonalization(profile, 'tsundere');
  assert(p.reliable === true, 'T8.7.7 personalization reliable after 5 sessions');
  assert(p.promptSummary.length > 50, 'T8.7.8 prompt summary is substantive');
}

// ══════════════════════════════════════════════════════════════════════════
// T8.8 — Pipeline wiring: server files accept anchorPersonalizationPrompt
// ══════════════════════════════════════════════════════════════════════════
console.log('\n📋 T8.8 — Pipeline wiring verification');
{
  const chatJs = fs.readFileSync('api/chat.js', 'utf8');
  const serverJs = fs.readFileSync('server.js', 'utf8');
  const claudeService = fs.readFileSync('services/claudeService.ts', 'utf8');

  assert(chatJs.includes('anchorPersonalizationPrompt'), 'T8.8.1 api/chat.js has anchorPersonalizationPrompt');
  assert(chatJs.includes('anchorPersonalizationPrompt}') || chatJs.includes('anchorPersonalizationPrompt,'), 'T8.8.2 api/chat.js destructures param');
  assert(serverJs.includes('anchorPersonalizationPrompt'), 'T8.8.3 server.js has anchorPersonalizationPrompt');
  assert(claudeService.includes('anchorPersonalizationPrompt'), 'T8.8.4 claudeService has anchorPersonalizationPrompt');

  // Verify injection into system prompt
  assert(chatJs.includes('Anchor personalization injected'), 'T8.8.5 api/chat.js logs personalization injection');
  assert(serverJs.includes('anchorPersonalizationPrompt') && serverJs.includes('parts.push(anchorPersonalizationPrompt)'), 'T8.8.6 server.js pushes personalization to parts');
}

// ══════════════════════════════════════════════════════════════════════════
// T8.9 — App.tsx integration verification
// ══════════════════════════════════════════════════════════════════════════
console.log('\n📋 T8.9 — App.tsx integration');
{
  const appTsx = fs.readFileSync('App.tsx', 'utf8');

  assert(appTsx.includes("import { loadAnchorProfile"), 'T8.9.1 imports loadAnchorProfile');
  assert(appTsx.includes("import { loadAnchorProfile") && appTsx.includes('saveAnchorProfile'), 'T8.9.2 imports saveAnchorProfile');
  assert(appTsx.includes('learnFromSession'), 'T8.9.3 imports learnFromSession');
  assert(appTsx.includes('getPersonalization'), 'T8.9.4 imports getPersonalization');
  assert(appTsx.includes('anchorProfile'), 'T8.9.5 anchorProfile state used');
  assert(appTsx.includes('anchorPersonalization'), 'T8.9.6 anchorPersonalization state used');
  assert(appTsx.includes('sessionFitEvalsRef'), 'T8.9.7 sessionFitEvalsRef for accumulation');
  assert(appTsx.includes('loadAnchorProfile(user.uid)'), 'T8.9.8 loads profile on init');
  assert(appTsx.includes('saveAnchorProfile(user.uid'), 'T8.9.9 saves profile on session end');
  assert(appTsx.includes('sessionFitEvalsRef.current.push'), 'T8.9.10 accumulates fit evals per turn');
  assert(appTsx.includes('anchorPersonalization.promptSummary') || appTsx.includes('anchorPersonalizationPrompt'), 'T8.9.11 passes personalization to claudeService');
}

// ══════════════════════════════════════════════════════════════════════════
// T8.10 — EmotionalDashboard anchor profile props
// ══════════════════════════════════════════════════════════════════════════
console.log('\n📋 T8.10 — EmotionalDashboard anchor profile visualization');
{
  const dashboard = fs.readFileSync('components/EmotionalDashboard.tsx', 'utf8');

  assert(dashboard.includes('UserAnchorProfile'), 'T8.10.1 imports UserAnchorProfile type');
  assert(dashboard.includes('AnchorPersonalization'), 'T8.10.2 imports AnchorPersonalization type');
  assert(dashboard.includes('anchorProfile?'), 'T8.10.3 anchorProfile prop defined');
  assert(dashboard.includes('anchorPersonalization?'), 'T8.10.4 anchorPersonalization prop defined');
  assert(dashboard.includes('Anchor Profile'), 'T8.10.5 renders anchor profile section');
  assert(dashboard.includes('dimensionAffinities'), 'T8.10.6 renders dimension affinities');
  assert(dashboard.includes('vectorPreferences'), 'T8.10.7 renders vector preferences');
}

// ══════════════════════════════════════════════════════════════════════════
// Summary
// ══════════════════════════════════════════════════════════════════════════
console.log(`\n${'═'.repeat(60)}`);
console.log(`Phase 5 Verification: ${pass} passed, ${fail} failed out of ${pass + fail}`);
console.log('═'.repeat(60));
if (fail > 0) process.exit(1);
