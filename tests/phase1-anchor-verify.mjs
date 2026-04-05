// Phase 1 Anchor Verification — Doc 10 §T1
// Run: node tests/phase1-anchor-verify.mjs
// Validates heuristicDecompose, pickAnchorMode, L0 coverage, buildAnchorPromptBlock.

import {
  heuristicDecompose,
  pickAnchorMode,
  getL0CoreAnchor,
  L0_CORE_ANCHORS,
  buildAnchorPromptBlock,
  computeTriVectorFieldData,
} from '../api/chat.js';

let pass = 0;
let fail = 0;
const failures = [];

function check(name, cond, detail = '') {
  if (cond) { pass++; console.log(`  ✓ ${name}`); }
  else      { fail++; failures.push(`${name} ${detail}`); console.log(`  ✗ ${name} ${detail}`); }
}

// ── T1.1 — heuristicDecompose: 10 sample goals, complexity in expected bands ──
console.log('\n[T1.1] Δ_GoalDecompose — 10 samples');
const samples = [
  { goal: '안녕',                                                                      min: 0.00, max: 0.20, mode: 'triangle' },
  { goal: '오늘 기분이 좀 힘들어',                                                    min: 0.05, max: 0.25, mode: 'triangle' },
  { goal: '파이썬 for 루프 예시 보여줘',                                              min: 0.08, max: 0.35, mode: 'triangle' },
  { goal: '왜 이 코드가 에러나는지 설명해줘',                                         min: 0.20, max: 0.55, mode: null }, // either triangle/square
  { goal: '랜딩 페이지 디자인하고 코드도 작성해줘',                                    min: 0.40, max: 0.75, mode: null },
  { goal: '이 논문 조사하고 요약해서 비교 분석해줘 그리고 느낀점도 알려줘',              min: 0.45, max: 0.95, mode: null },
  { goal: '기분이 우울한데 위로해주면서 동시에 왜 그런지 분석하고 해결책 코드까지 구현해줘', min: 0.55, max: 1.00, mode: null },
  { goal: 'UI 디자인해, 코드 구현해, 감정 분석도 해, 논리 검증도 해, 창작 아이디어도 내줘', min: 0.80, max: 1.00, mode: null },
  { goal: '함수 버그 고쳐줘',                                                         min: 0.05, max: 0.30, mode: 'triangle' },
  { goal: '이유가 뭔지 근거를 들어 설명하고 비교 평가까지 해줘',                       min: 0.20, max: 0.65, mode: null },
];
for (const s of samples) {
  const d = heuristicDecompose(s.goal);
  const mode = pickAnchorMode(d.complexity);
  const okRange = d.complexity >= s.min && d.complexity <= s.max;
  const okMode  = s.mode ? mode === s.mode : true;
  check(`"${s.goal.slice(0, 30)}..." complexity=${d.complexity} mode=${mode}`, okRange && okMode,
        okRange ? '' : `(expected ${s.min}-${s.max})`);
}

// ── T1.2 — pickAnchorMode boundary ────────────────────────────────────────────
console.log('\n[T1.2] pickAnchorMode boundaries');
check('0.0 → triangle',  pickAnchorMode(0.0)  === 'triangle');
check('0.39 → triangle', pickAnchorMode(0.39) === 'triangle');
check('0.4 → square',    pickAnchorMode(0.4)  === 'square');
check('0.69 → square',   pickAnchorMode(0.69) === 'square');
check('0.7 → pentagon',  pickAnchorMode(0.7)  === 'pentagon');
check('0.89 → pentagon', pickAnchorMode(0.89) === 'pentagon');
check('0.9 → equation',  pickAnchorMode(0.9)  === 'equation');
check('1.0 → equation',  pickAnchorMode(1.0)  === 'equation');

// ── T1.3 — L0 Core Anchor coverage: all 12 personas present ───────────────────
console.log('\n[T1.3] L0 Core Anchor coverage');
const expected = ['arha','tsundere','cool','airhead','yandere','luxe','artist','danjon','aeshin','milim','mochi','claude'];
for (const p of expected) {
  const L0 = getL0CoreAnchor(p);
  check(`L0[${p}] has hierarchyNotation`, !!L0.hierarchyNotation && L0.hierarchyNotation.includes('A1_'));
  check(`L0[${p}] has antiSycophantic`,    !!L0.antiSycophantic && L0.antiSycophantic.length > 10);
  check(`L0[${p}] driftTolerance ∈ [0.05, 0.35]`, L0.driftTolerance >= 0.05 && L0.driftTolerance <= 0.35);
}
check('unknown persona falls back to arha', getL0CoreAnchor('__unknown__').identityName === 'ARHA_Core');
check('L0_CORE_ANCHORS has exactly 12 entries', Object.keys(L0_CORE_ANCHORS).length === 12);

// ── T1.4 — buildAnchorPromptBlock format ──────────────────────────────────────
console.log('\n[T1.4] buildAnchorPromptBlock output shape');
const triData = computeTriVectorFieldData([]);
const block = buildAnchorPromptBlock('arha', '파이썬 for 루프 예시 보여줘', triData);
check('has "## Active Anchor Field"', block.includes('## Active Anchor Field'));
check('has L0 section',               block.includes('### L0 [locked'));
check('has L1 Main section',          block.includes('### L1 Main'));
check('has L2 Sub section',           block.includes('### L2 Sub'));
check('has Cross-Vector Pull',        block.includes('### Cross-Vector Pull'));
check('has Response Directive',       block.includes('### Response Directive'));
check('embeds ARHA_Core identity',    block.includes('ARHA_Core'));
check('embeds hierarchy notation',    block.includes('A1_Honesty'));

const blockTsun = buildAnchorPromptBlock('tsundere', 'UI 디자인해, 코드 구현해, 감정 분석도 해, 논리 검증도 해, 창작 아이디어도 내줘, 조사도 부탁', triData);
check('tsundere uses Tsundere_Core',  blockTsun.includes('Tsundere_Core'));
check('high-complexity → pentagon or equation', /mode:(pentagon|equation)/.test(blockTsun), blockTsun.match(/mode:\w+/)?.[0] || '');

// ── T1.5 — L1 key mapping reflects dominant fx ────────────────────────────────
console.log('\n[T1.5] L1 key routing');
const triHigh = computeTriVectorFieldData([]);
// defaults produce some dominant fx; just verify block contains at least one V_ key
const blockDefault = buildAnchorPromptBlock('arha', 'hi', triHigh);
check('block contains V_Agency / V_Morning / V_Musical',
      /V_Agency|V_Morning|V_Musical/.test(blockDefault));

// ── Summary ───────────────────────────────────────────────────────────────────
console.log(`\n════════════════════════════════════════`);
console.log(`  Phase 1 Verification: ${pass} passed / ${fail} failed`);
console.log(`════════════════════════════════════════`);
if (fail > 0) {
  console.log('\nFailures:');
  failures.forEach(f => console.log('  ' + f));
  process.exit(1);
}
process.exit(0);
