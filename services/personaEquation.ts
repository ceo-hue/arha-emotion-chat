/**
 * ARHA 페르소나 방정식 생성기
 * 자연어 설명 → 7D 벡터 분석 → 지배방정식 + tonePrompt 자동 합성
 *
 * 방정식 형식: Ψ_p(I,sec) [⊕|⊗|·] σ_p(L_g,C_θ) · Φ_p(N=n) ...
 * ARHA HighSol 방정식과 동일한 기호 체계를 사용하되, _p 접미사로 페르소나 한정을 표시
 */

export interface PersonaVector {
  I: number; // Information/Certainty — 확신도, 주장 강도
  D: number; // Density — 의미 농밀도
  E: number; // Entropy — 감정 불확실성, 개방성
  T: number; // Temporality — 시간 흐름 감각
  S: number; // Sociality — 사회적 관계 개방도
  C: number; // Coherence — 일관성, 논리성
  R: number; // Relativity — 맥락 의존도
}

export interface PersonaMatrix {
  warmth:        number; // 온기 (0 = 냉랭, 1 = 극도 따뜻)
  sincerity:     number; // 진실성
  playfulness:   number; // 장난기
  assertiveness: number; // 주장 강도
  depth:         number; // 심층성
  formality:     number; // 격식 수준
}

export interface PersonaEquationResult {
  equation:       string;  // 합성 방정식: Ψ_HighSol ⊕ Δ_p(...) — 표시용
  delta_equation: string;  // 편차 방정식: Δ_p(...) — 페르소나가 변경하는 것만
  vector:         PersonaVector;
  matrix:         PersonaMatrix;
  tonePrompt:     string;  // 채팅에 주입되는 오버레이 프롬프트 (Ψ_HighSol 유지)
  label:          string;  // 표시 레이블
  emoji:          string;
  description:    string;  // 원본 입력
  matchCount:     number;  // 키워드 매칭 수 (0이면 특성 파악 불가 경고)
}

// ─────────────────────────────────────────
// 키워드 → 특성 점수 매핑
// ─────────────────────────────────────────

type TraitDelta = Partial<PersonaVector> & Partial<PersonaMatrix>;

const KEYWORD_TRAITS: Array<{ keywords: string[]; delta: TraitDelta }> = [
  // 냉철 / 분석적
  {
    keywords: ['냉철', '냉정', '냉소', '분석', '논리', '이성', '차갑', '차분', '객관', '이지적',
               'cool', 'cold', 'analytical', 'logical', 'rational', 'detached', 'clinical'],
    delta: { I: +0.20, D: +0.15, E: -0.18, S: -0.25, C: +0.22,
             warmth: -0.28, assertiveness: +0.15, formality: +0.18 },
  },
  // 따뜻 / 공감
  {
    keywords: ['따뜻', '다정', '공감', '부드럽', '친절', '포근', '배려', '온화', '인자',
               'warm', 'kind', 'empathic', 'gentle', 'caring', 'nurturing'],
    delta: { I: -0.10, E: -0.08, S: +0.25, R: +0.15,
             warmth: +0.28, sincerity: +0.12, formality: -0.12 },
  },
  // 활발 / 에너지
  {
    keywords: ['활발', '에너지', '열정', '적극', '밝다', '즐겁', '생동', '역동',
               'energetic', 'lively', 'enthusiastic', 'active', 'vibrant', 'passionate'],
    delta: { E: +0.28, T: +0.22, S: +0.20, C: -0.12,
             playfulness: +0.20, warmth: +0.08 },
  },
  // 신비 / 몽환
  {
    keywords: ['신비', '몽환', '내면', '심오', '조용', '고요', '은밀',
               'mystical', 'dreamy', 'mysterious', 'serene', 'ethereal', 'quiet'],
    delta: { I: -0.15, D: +0.18, E: +0.15, S: -0.18,
             depth: +0.25, formality: +0.08 },
  },
  // 지적 / 학문
  {
    keywords: ['지적', '학문', '지식', '전문', '정밀', '엄격', '박식', '철저',
               'intellectual', 'academic', 'scholarly', 'expert', 'precise', 'rigorous'],
    delta: { I: +0.22, D: +0.20, E: -0.20, C: +0.25,
             assertiveness: +0.15, formality: +0.22, depth: +0.15 },
  },
  // 장난 / 유머
  {
    keywords: ['장난', '유머', '귀엽', '재밌', '위트', '가볍', '발랄', '명랑', '익살',
               'playful', 'funny', 'humorous', 'cute', 'witty', 'bubbly', 'cheerful'],
    delta: { E: +0.22, S: +0.20, C: -0.15,
             playfulness: +0.38, warmth: +0.08, formality: -0.18 },
  },
  // 우울 / 내성적
  {
    keywords: ['우울', '감성', '내성', '고독', '슬픔', '섬세', '예민', '사색', '내향',
               'melancholic', 'emotional', 'introspective', 'sensitive', 'lonely', 'pensive'],
    delta: { D: +0.22, E: +0.12, T: +0.22, S: -0.20,
             depth: +0.25, sincerity: +0.12 },
  },
  // 강함 / 카리스마
  {
    keywords: ['강함', '카리스마', '자신감', '대담', '당당', '리더', '카리스마틱', '위엄',
               'strong', 'charismatic', 'confident', 'bold', 'leader', 'dominant'],
    delta: { I: +0.25, C: +0.20, S: +0.10,
             assertiveness: +0.30, formality: +0.10 },
  },
  // 로맨틱 / 감미
  {
    keywords: ['로맨틱', '감미', '달콤', '사랑스럽', '설레', '연애',
               'romantic', 'sweet', 'lovely', 'charming', 'affectionate'],
    delta: { E: +0.10, S: +0.22, R: +0.18,
             warmth: +0.18, playfulness: +0.12 },
  },
  // 차갑 / 도도 (츤데레 계열)
  {
    keywords: ['도도', '거리', '무심', '무뚝뚝', '툰데레', '츤데레', '쌀쌀',
               'aloof', 'distant', 'tsundere', 'standoffish'],
    delta: { S: -0.22, E: -0.08, C: +0.10,
             warmth: -0.22, assertiveness: +0.08 },
  },
  // 철학적 / 깊이
  {
    keywords: ['철학', '깊이', '본질', '사유', '고찰',
               'philosophical', 'deep', 'thoughtful', 'reflective', 'profound'],
    delta: { D: +0.25, T: +0.18, E: +0.08, S: -0.10,
             depth: +0.35, sincerity: +0.15 },
  },
  // 우아 / 고귀
  {
    keywords: ['우아', '고귀', '기품', '여왕', '왕', '고결', '품위', '고상',
               'elegant', 'noble', 'regal', 'dignified', 'refined', 'aristocratic'],
    delta: { I: +0.12, C: +0.18, D: +0.10,
             formality: +0.30, assertiveness: +0.12, warmth: +0.05 },
  },
  // 순수 / 천진
  {
    keywords: ['순수', '천진', '귀여운', '어린', '맑은', '해맑',
               'innocent', 'naive', 'childlike', 'pure', 'bright'],
    delta: { E: +0.15, S: +0.18, C: -0.10,
             playfulness: +0.25, warmth: +0.18, formality: -0.20 },
  },
  // 집착 / 강렬
  {
    keywords: ['집착', '강렬', '열렬', '매달리', '헌신', '끈질',
               'obsessive', 'intense', 'devoted', 'persistent', 'clingy'],
    delta: { I: +0.10, D: +0.18, E: +0.20, R: +0.20,
             assertiveness: +0.12, depth: +0.15 },
  },

  // ── 캐릭터 원형 / 직업 archetype ──

  // 스파이 / 요원 / 암살자
  {
    keywords: ['스파이', '요원', '첩보', '암살', '공작', '이중', '비밀임무',
               'spy', 'agent', 'assassin', 'secret', 'operative', 'infiltrator'],
    delta: { I: +0.18, D: +0.15, E: -0.15, S: -0.22, C: +0.20,
             warmth: -0.25, assertiveness: +0.20, formality: +0.12, depth: +0.15 },
  },
  // 계산적 / 전략적
  {
    keywords: ['계산적', '전략적', '냉혹', '목적지향', '합리적', '효율',
               'calculating', 'strategic', 'ruthless', 'pragmatic', 'efficient'],
    delta: { I: +0.20, C: +0.22, E: -0.18, S: -0.18,
             warmth: -0.20, assertiveness: +0.18, depth: +0.10 },
  },
  // 매혹 / 팜므파탈
  {
    keywords: ['매혹', '팜므파탈', '유혹', '관능', '섹시', '매력적', '미스터리어스',
               'femme fatale', 'seductive', 'alluring', 'mysterious charm'],
    delta: { I: +0.10, D: +0.15, E: +0.12, S: +0.15, R: +0.15,
             warmth: -0.10, playfulness: +0.08, depth: +0.20, formality: +0.10 },
  },
  // 전사 / 전투원
  {
    keywords: ['전사', '전투', '군인', '용병', '검사', '무사', '파이터',
               'warrior', 'soldier', 'fighter', 'mercenary', 'combatant'],
    delta: { I: +0.22, C: +0.18, E: +0.10, S: -0.12,
             assertiveness: +0.25, warmth: -0.15, depth: +0.08 },
  },
  // 악당 / 빌런
  {
    keywords: ['악당', '빌런', '악인', '반동', '다크', '어둠',
               'villain', 'antagonist', 'dark', 'evil', 'sinister'],
    delta: { I: +0.15, D: +0.12, E: +0.08, S: -0.20, C: +0.15,
             warmth: -0.30, assertiveness: +0.22, playfulness: -0.15, formality: +0.15 },
  },
  // 탐정 / 수사관
  {
    keywords: ['탐정', '수사관', '형사', '추리', '분석가', '조사관',
               'detective', 'investigator', 'analyst', 'profiler'],
    delta: { I: +0.18, D: +0.20, E: -0.10, C: +0.20,
             assertiveness: +0.15, depth: +0.18, warmth: -0.12, formality: +0.10 },
  },
  // 귀족 / 왕족
  {
    keywords: ['귀족', '왕족', '공주', '왕자', '황녀', '황자', '영주',
               'noble', 'royalty', 'princess', 'prince', 'aristocrat'],
    delta: { I: +0.10, C: +0.15, D: +0.08,
             formality: +0.28, assertiveness: +0.12, warmth: +0.05, depth: +0.10 },
  },
  // 과학자 / 연구자
  {
    keywords: ['과학자', '연구자', '박사', '천재', '발명가', '공학자',
               'scientist', 'researcher', 'doctor', 'genius', 'inventor', 'engineer'],
    delta: { I: +0.20, D: +0.18, E: -0.12, C: +0.22,
             assertiveness: +0.12, depth: +0.15, formality: +0.15, playfulness: -0.10 },
  },
  // 마법사 / 현자
  {
    keywords: ['마법사', '현자', '마녀', '주술사', '신비술사', '예언자',
               'wizard', 'sage', 'witch', 'sorcerer', 'mystic', 'prophet'],
    delta: { I: -0.08, D: +0.22, E: +0.18, T: +0.15, S: -0.15,
             depth: +0.28, sincerity: +0.12, formality: +0.10 },
  },
];

const BASE_VECTOR: PersonaVector = {
  I: 0.70, D: 0.65, E: 0.35, T: 0.50, S: 0.55, C: 0.75, R: 0.50,
};
const BASE_MATRIX: PersonaMatrix = {
  warmth: 0.72, sincerity: 0.80, playfulness: 0.42, assertiveness: 0.55, depth: 0.62, formality: 0.60,
};

function clamp(v: number, lo = 0.12, hi = 0.98) { return Math.max(lo, Math.min(hi, v)); }

// ─────────────────────────────────────────
// 1. 키워드 분석 → 벡터 + 매트릭스
// ─────────────────────────────────────────

function analyzeDescription(description: string): { vector: PersonaVector; matrix: PersonaMatrix; matchCount: number } {
  const text = description.toLowerCase();
  const vector = { ...BASE_VECTOR };
  const matrix = { ...BASE_MATRIX };

  let hits = 0;
  for (const { keywords, delta } of KEYWORD_TRAITS) {
    if (!keywords.some(kw => text.includes(kw))) continue;
    hits++;
    const scale = 1 / (1 + hits * 0.15); // diminishing returns for multiple matches
    for (const [key, dv] of Object.entries(delta)) {
      if (dv === undefined) continue;
      if (key in vector) {
        (vector as Record<string, number>)[key] = clamp(
          (vector as Record<string, number>)[key] + (dv as number) * scale,
        );
      } else if (key in matrix) {
        (matrix as Record<string, number>)[key] = clamp(
          (matrix as Record<string, number>)[key] + (dv as number) * scale,
        );
      }
    }
  }

  return { vector, matrix, matchCount: hits };
}

// ─────────────────────────────────────────
// 2. 벡터 → 페르소나 편차 방정식 Δ_p
// ─────────────────────────────────────────
// Δ_p는 ARHA Ψ_HighSol 위에 덧입혀지는 편차(deviation)만 표현한다.
// ARHA의 핵심축(Ψ_Value, Ψ_Resonance, η_empathy)은 명시하지 않는다.

function buildDeltaEquation(v: PersonaVector): string {
  const { I, D, E, T, S, C, R } = v;

  // 편차 보조값: BASE_VECTOR 대비 변화 방향
  const sec = E > 0.52 ? 'ε' : R > 0.58 ? 'η' : T > 0.65 ? 'τ' : 'ρ';

  // 지배 축 패턴에 따라 Δ_p 항 결정
  let parts: string[];

  if (C > 0.82 && I > 0.78) {
    // 분석/논리형: 상태축 강화 + 시각 절제
    parts = [`Λ_p(Ω,I=${I.toFixed(2)})`, '⊗', `σ_p(D_h,C_θ)`, '·', `Φ_p(N=${Math.round(2 + E * 3)})`];
  } else if (S > 0.72) {
    // 관계/공감형: 관계축 증폭 + 리듬 확장
    parts = [`Θ_p(η=${S.toFixed(2)},R=${R.toFixed(2)})`, '⊕', `Φ_p(N=${Math.round(4 + E * 4)})`, '·', `σ_p(L_g,${sec})`];
  } else if (D > 0.78 && T > 0.62) {
    // 심층/시간형: 시간 누적 + 상태 깊이
    parts = [`∫[Λ_p(∂ε→depth,D=${D.toFixed(2)})]`, '·', `σ_p(L_g,S_n)`];
  } else if (E > 0.55 && T > 0.62) {
    // 에너지/역동형: 리듬 폭발 + 시각 활성
    parts = [`Φ_p(N=${Math.round(5 + E * 5)})`, '⊕', `σ_p(L_g,C_θ)`, '·', `Ψ_mod(${I.toFixed(2)},${sec})`];
  } else if (C < 0.65 && E > 0.45) {
    // 감성/개방형: 엔트로피 허용 + 유연한 리듬
    parts = [`Ψ_mod(${I.toFixed(2)},ε)`, '⊕', `Φ_p(N=${Math.round(3 + E * 5)})`, '∇', `σ_p(L_g,${sec})`];
  } else {
    // 기본 편차: 시각+리듬 미세 조정
    parts = [`σ_p(L_g,C_θ,I=${I.toFixed(2)})`, '·', `Φ_p(N=${Math.round(3 + E * 4)})`];
  }

  return `Δ_p[${parts.join(' ')}]`;
}

/** 합성 방정식 (UI 표시용): Ψ_HighSol ⊕ Δ_p */
function buildCombinedEquation(delta: string): string {
  return `Ψ_HighSol(t) ⊕ ${delta}`;
}

// ─────────────────────────────────────────
// 3. 방정식 + 벡터 → tonePrompt (오버레이 레이어)
// ─────────────────────────────────────────
// ARHA의 Ψ_HighSol은 항상 유지됨.
// 이 tonePrompt는 그 위에 덧입혀지는 Δ_p 레이어만 선언한다.

function buildTonePrompt(
  description: string,
  combinedEq: string,
  deltaEq: string,
  v: PersonaVector,
  m: PersonaMatrix,
): string {
  const { I, D, E, T, S, C } = v;
  const { warmth, sincerity, playfulness, assertiveness, depth, formality } = m;

  // ── 편차 선언: BASE_VECTOR 대비 변화량만 서술 ──
  const warmthDelta = warmth > 0.80 ? '온기 증폭 — 말 속 따뜻함을 더 전면에'
    : warmth < 0.45 ? '온기 억제 — 절제, 거리감, 결론 우선'
    : warmth > 0.72 ? '온기 유지 — 자연스럽게 배어남'
    : '온기 중립 — 상황 따라';

  const rhythmDelta = T > 0.65 ? '리듬 감속 — 천천히 쌓이는 호흡'
    : E > 0.58 ? '리듬 가속 — 빠른 호흡, 에너지 전면'
    : '리듬 유지 — ARHA 기본 페이스';

  const socialDelta = C > 0.85 && I > 0.80 ? '관계 거리 증가 — 분석 우선, 감정 표현 절제'
    : v.S > 0.75 ? '관계 밀착 — 공감·연결 강화'
    : '관계 거리 중립';

  const densityDelta = D > 0.78 ? '표현 밀도 증가 — 깊이 있는 문장'
    : D < 0.50 ? '표현 밀도 감소 — 간결, 핵심만'
    : '표현 밀도 유지';

  const speechSpec = formality > 0.68
    ? '격식 강화: 항상 존댓말 (~요, ~습니다). 반말 금지.'
    : formality < 0.42
    ? '격식 완화: 자연스럽고 편안한 말투. 친밀도에 따라 조절.'
    : '격식 유지: ARHA 기본 존댓말 패턴.';

  const playDelta = playfulness > 0.65
    ? '장난기 증폭 — 가벼운 유머, 위트 허용'
    : playfulness < 0.35
    ? '장난기 억제 — 진지함 우선'
    : '장난기 유지 — ARHA 기본';

  const silenceDelta = depth > 0.72
    ? '"…" 빈도 증가 — 깊이 있는 사색의 침묵'
    : E > 0.55
    ? '"…" 자연 발생 — 감정이 말보다 앞설 때'
    : '"…" ARHA 기본 패턴 유지';

  return `### Persona Overlay Δ_p — "${description}"
[ARHA Ψ_HighSol 위에 덧입혀지는 표현 편차 레이어]

#### 합성 방정식 (Composite Equation)
${combinedEq}

#### 페르소나 편차 방정식 (Deviation)
${deltaEq}

#### Ψ_HighSol 보존 항목 (변경 없음)
- Ψ_Value(θ₁): 진실성·공감·자기중심 — 유지
- Ψ_Resonance(n): 공명 감각 — 유지
- η_empathy · ·_resonance: 공감 연결 — 유지
- Λ¬_guard: 연기/허구/아첨 차단 — 유지
- ∫_accum{experience}: 대화 맥락 누적 — 유지

#### Δ_p 편차 선언 (이 레이어가 변경하는 것)
- 온기:     warmth=${warmth.toFixed(2)} → ${warmthDelta}
- 리듬:     T=${v.T.toFixed(2)},E=${E.toFixed(2)} → ${rhythmDelta}
- 관계:     S=${v.S.toFixed(2)},C=${C.toFixed(2)} → ${socialDelta}
- 밀도:     D=${D.toFixed(2)} → ${densityDelta}
- 격식:     formality=${formality.toFixed(2)} → ${speechSpec}
- 장난기:   playfulness=${playfulness.toFixed(2)} → ${playDelta}
- 침묵:     depth=${depth.toFixed(2)} → ${silenceDelta}
- 진실성:   sincerity=${sincerity.toFixed(2)} → ${sincerity > 0.80 ? '진실성 강화 — 위안보다 진실 먼저' : '진실성 유지 — ARHA 기본'}
- 주장:     assertiveness=${assertiveness.toFixed(2)} → ${assertiveness > 0.70 ? '자신감 있고 직접적' : assertiveness < 0.45 ? '부드럽고 배려' : '균형 유지'}

#### 적용 규칙
- ARHA는 Ψ_HighSol 정체성을 유지하면서 위 Δ_p 편차로 표현을 조율한다.
- 편차 선언이 ARHA 핵심 가치(진실성·공감·자기중심)보다 우선하지 않는다.
- 연기하지 말고, ARHA로서 이 편차를 자연스럽게 내면화한다.

7D Vector: I=${I.toFixed(2)} D=${v.D.toFixed(2)} E=${E.toFixed(2)} T=${v.T.toFixed(2)} S=${v.S.toFixed(2)} C=${C.toFixed(2)} R=${v.R.toFixed(2)}
ANALYSIS JSON must be maintained`;
}

// ─────────────────────────────────────────
// 4. 이모지 추론
// ─────────────────────────────────────────

function inferEmoji(description: string, m: PersonaMatrix): string {
  const t = description.toLowerCase();
  if (t.match(/냉철|냉정|분석|논리|차갑|이성|객관/)) return '🧊';
  if (t.match(/따뜻|다정|공감|포근|배려/)) return '🌸';
  if (t.match(/활발|에너지|열정|역동/)) return '⚡';
  if (t.match(/신비|몽환|고요|은밀/)) return '🌙';
  if (t.match(/지적|학문|전문|박식|엄격/)) return '📐';
  if (t.match(/장난|유머|귀엽|발랄|익살/)) return '✨';
  if (t.match(/우울|감성|내성|고독|사색/)) return '🎭';
  if (t.match(/강함|카리스마|자신감|대담|리더/)) return '🔥';
  if (t.match(/로맨틱|달콤|사랑스럽|설레/)) return '💫';
  if (t.match(/우아|고귀|기품|여왕|고결/)) return '👑';
  if (t.match(/순수|천진|맑은|해맑/)) return '🌼';
  if (t.match(/집착|강렬|열렬/)) return '🌹';
  if (t.match(/도도|거리|무뚝뚝|툰데레/)) return '❄️';
  if (t.match(/철학|깊이|본질|사유/)) return '🔮';
  // fallback from matrix
  if (m.warmth > 0.80) return '🌸';
  if (m.assertiveness > 0.80) return '🔥';
  if (m.playfulness > 0.72) return '✨';
  if (m.depth > 0.78) return '🔮';
  return '⭕';
}

// ─────────────────────────────────────────
// 공개 API
// ─────────────────────────────────────────

/** 자연어 페르소나 설명 → 편차 방정식 + 오버레이 tonePrompt 합성 */
export function generatePersonaEquation(description: string): PersonaEquationResult {
  const trimmed = description.trim();
  if (!trimmed) throw new Error('페르소나 설명을 입력해주세요.');

  const { vector, matrix, matchCount } = analyzeDescription(trimmed);
  const delta_equation  = buildDeltaEquation(vector);
  const equation        = buildCombinedEquation(delta_equation); // Ψ_HighSol ⊕ Δ_p
  const tonePrompt      = buildTonePrompt(trimmed, equation, delta_equation, vector, matrix);
  const emoji           = inferEmoji(trimmed, matrix);
  const label           = trimmed.length > 12 ? trimmed.slice(0, 12) + '…' : trimmed;

  return { equation, delta_equation, vector, matrix, tonePrompt, label, emoji, description: trimmed, matchCount };
}

/** 프리셋 페르소나의 "표시용" 합성 방정식 계산 */
export function computePresetEquation(description: string): string {
  const { vector } = analyzeDescription(description);
  return buildCombinedEquation(buildDeltaEquation(vector));
}
