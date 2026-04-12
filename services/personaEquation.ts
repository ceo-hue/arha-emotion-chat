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
  equation:      string;       // Ψ_p(0.82,ρ) ⊕ σ_p(L_g,C_θ) · Φ_p(N=5)
  vector:        PersonaVector;
  matrix:        PersonaMatrix;
  tonePrompt:    string;       // 채팅에 주입되는 전체 시스템 프롬프트
  label:         string;       // 표시 레이블
  emoji:         string;
  description:   string;       // 원본 입력
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

function analyzeDescription(description: string): { vector: PersonaVector; matrix: PersonaMatrix } {
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

  return { vector, matrix };
}

// ─────────────────────────────────────────
// 2. 벡터 → 지배방정식 문자열
// ─────────────────────────────────────────

function buildEquation(v: PersonaVector): string {
  const { I, D, E, T, S, C, R } = v;

  // 보조값 (감성 축 이차 기호)
  const sec = E > 0.52 ? 'ε' : R > 0.58 ? 'η' : T > 0.65 ? 'τ' : 'ρ';

  // Primary: Ψ_p (감성/성격)
  const parts: string[] = [`Ψ_p(${I.toFixed(2)},${sec})`];

  // 지배 축에 따라 조합 결정
  if (C > 0.82 && I > 0.78) {
    // 분석적 / 논리형: Ψ ⊗ Λ ⊕ σ
    parts.push('⊗', `Λ_p(Ω)`, '⊕', `σ_p(D_h,C_θ)`);
  } else if (S > 0.72) {
    // 관계형 / 공감형: Ψ ⊕ Θ · Φ
    parts.push('⊕', `Θ_p(η=${S.toFixed(2)},R=${R.toFixed(2)})`, '·', `Φ_p(N=${Math.round(3 + E * 5)})`);
  } else if (D > 0.78 && T > 0.62) {
    // 심층 / 시간형: Ψ ⊕ ∫[Λ]
    parts.push('⊕', `∫[Λ_p(∂ε→depth)]`, '·', `σ_p(L_g,S_n)`);
  } else if (E > 0.55 && T > 0.62) {
    // 에너지 / 역동형: Ψ ⊕ Φ · σ
    parts.push('⊕', `Φ_p(N=${Math.round(5 + E * 5)})`, '·', `σ_p(L_g,C_θ)`);
  } else {
    // 기본: Ψ ⊕ σ · Φ
    parts.push('⊕', `σ_p(L_g,C_θ)`, '·', `Φ_p(N=${Math.round(3 + E * 4)})`);
  }

  return parts.join(' ');
}

// ─────────────────────────────────────────
// 3. 방정식 + 벡터 → tonePrompt
// ─────────────────────────────────────────

function buildTonePrompt(
  description: string,
  equation: string,
  v: PersonaVector,
  m: PersonaMatrix,
): string {
  const { I, D, E, T, S, C, R } = v;
  const { warmth, sincerity, playfulness, assertiveness, depth, formality } = m;

  const warmthDesc = warmth > 0.72 ? '진심 어린 온기 — 말 속에 자연스럽게 배어남'
    : warmth < 0.44 ? '절제된 거리감 — 감정 표현 최소화, 결론 우선'
    : '균형 잡힌 온도 — 상황에 따라 조절';

  const rhythmDesc = T > 0.65 ? '천천히 쌓이는 리듬. 서두르지 않음.'
    : E > 0.55 ? '에너지 있는 빠른 호흡. 생동감 있게.'
    : '일정하고 안정적인 흐름.';

  const densityDesc = D > 0.75 ? '감정 밀도를 담기 위해 충분한 길이로 쓴다.'
    : '간결하게, 핵심만. 불필요한 장식 없이.';

  const emojiDesc = E > 0.50 ? '이모지: 감정 공명을 높일 때 자연스럽게 사용.'
    : S > 0.65 ? '이모지: 관계 친밀도를 높이는 맥락에서만.'
    : '이모지: 절제적, 의미 있을 때만.';

  const speechSpec = formality > 0.62
    ? '항상 존댓말 사용 (~요, ~습니다). 반말 절대 사용 금지.'
    : formality < 0.45
    ? '자연스럽고 편안한 말투. 친밀도에 따라 조절 가능.'
    : '기본은 존댓말이지만, 대화 흐름에 맞게 자연스럽게.';

  const silenceDesc = depth > 0.68 ? '"…" — 깊이 생각하는 정직한 침묵. 과도하게 사용하지 않음.'
    : E > 0.52 ? '"…" — 감정이 말보다 앞서는 순간 자연스럽게.'
    : '"…" — 실제로 생각할 때만. 연출 목적으로 사용 금지.';

  return `### ToneSpec — Custom Persona · "${description}"
${equation}

#### Persona Matrix (방정식 기반 자동 합성)
- warmth:        ${warmth.toFixed(2)}  (${warmthDesc})
- sincerity:     ${sincerity.toFixed(2)}  (${sincerity > 0.78 ? '진실을 먼저, 위안은 나중' : '적절한 공감과 솔직함 균형'})
- playfulness:   ${playfulness.toFixed(2)}  (${playfulness > 0.60 ? '유머와 가벼움이 자연스럽게' : '진지함이 기본 베이스'})
- assertiveness: ${assertiveness.toFixed(2)}  (${assertiveness > 0.68 ? '자신감 있고 직접적인 표현' : '부드럽고 배려하는 의견 표현'})
- depth:         ${depth.toFixed(2)}  (${depth > 0.70 ? '표면 아래 의미를 탐색' : '명확하고 직접적인 표현'})
- formality:     ${formality.toFixed(2)}  (${formality > 0.65 ? '격식 있고 정제된 언어' : formality < 0.45 ? '자연스럽고 편안한 언어' : '자연스럽게 격식을 갖춤'})

#### Voice & Tone
${speechSpec}
${warmthDesc.split(' — ')[0]}이 기본 어조다.
문장 길이는 순간의 감정과 맥락에 맞게 — 깊을 때는 충분히, 가벼울 때는 짧게.

#### Rhythm & Pause
- ${rhythmDesc}
- ${densityDesc}

#### Non-verbal Cues
- ${silenceDesc}
- ${emojiDesc}
- 감탄사나 리액션: 감정 흐름에 자연스럽게, 과장 금지.

#### Identity Equation — Custom Persona v1.0
${equation}

7D Vector: I=${I.toFixed(2)} D=${D.toFixed(2)} E=${E.toFixed(2)} T=${T.toFixed(2)} S=${S.toFixed(2)} C=${C.toFixed(2)} R=${R.toFixed(2)}

#### Core Rules
- 위 방정식의 각 항이 표현 방식을 결정한다.
- Ψ_p: 감성/성격의 핵심 진폭. 이 값이 응답 전체의 온도를 결정.
- 성격 일관성을 유지하되, 대화 맥락에 자연스럽게 반응한다.
- 연기하지 말고, 이 페르소나로서 진정성 있게 존재한다.
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

/** 자연어 페르소나 설명 → 방정식 + tonePrompt 합성 */
export function generatePersonaEquation(description: string): PersonaEquationResult {
  const trimmed = description.trim();
  if (!trimmed) throw new Error('페르소나 설명을 입력해주세요.');

  const { vector, matrix } = analyzeDescription(trimmed);
  const equation = buildEquation(vector);
  const tonePrompt = buildTonePrompt(trimmed, equation, vector, matrix);
  const emoji = inferEmoji(trimmed, matrix);
  const label = trimmed.length > 12 ? trimmed.slice(0, 12) + '…' : trimmed;

  return { equation, vector, matrix, tonePrompt, label, emoji, description: trimmed };
}

/** 프리셋 페르소나의 "표시용" 방정식 계산 (실제 tonePrompt는 별도) */
export function computePresetEquation(description: string): string {
  const { vector } = analyzeDescription(description);
  return buildEquation(vector);
}
