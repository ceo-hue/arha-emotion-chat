export const config = { maxDuration: 60 };

// ─────────────────────────────────────────────────────────────────────────────
// NARRATION SCRIPT GENERATOR — Claude 기반 영상 스크립트 생성
// Input:  { concept, type, shotCount, expressionMode?, trajectory? }
// Output: { consistencyAnchor, shots: [{ index, narration, visualPrompt, duration }] }
// ─────────────────────────────────────────────────────────────────────────────

// Layer A-1: expressionMode → 내레이션 문체 지시
// ARHA 함수언어체계의 표현모드를 스크립트 톤으로 직접 이식
const EXPRESSION_NARRATION_MAP = {
  SOFT_WARMTH:     '따뜻하고 진심 어린 문체. 일상적이고 친근한 말투. 공감이 자연스럽게 배어 나오도록. 문장이 너무 길지 않게.',
  DEEP_EMPATHY:    '천천히, 무게 있는 문장. 쉼표와 여백을 많이 써라. 듣는 사람의 감정을 먼저 담아내고, 해결보다 공명을 우선. 짧고 강한 문장 뒤에 긴 여운.',
  INTENSE_JOY:     '짧고 터지는 문장. 에너지를 폭발시켜라. 감탄사와 강조를 아끼지 마라. 리듬이 빠르고 들뜨게. 느낌표를 두려워하지 마라.',
  ANALYTIC_THINK:  '정보 밀도 높게. 논리 전개 명확히. 결론 먼저, 근거 나중. 감정보다 사실과 인사이트 중심. 깔끔하고 간결하게.',
  REFLECTIVE_GROW: '과거를 천천히 돌아보는 시선. 회상과 성장의 서사. 지금의 나와 그때의 나 사이 거리감. 문장이 내면으로 향하게. 쉼표 많이, 속도 느리게.',
  PLAYFUL_TEASE:   '장난기 있고 유쾌하게. 예상을 비틀어라. 위트 있는 표현, 가벼운 반전. 너무 진지하지 않게. 미소가 나오는 문장.',
  SERENE_SMILE:    '조용하고 고요하게. 말이 많지 않아도 돼. 여백이 말을 하게. 따뜻하지만 차분한 온도. 짧고 여운 있는 문장.',
};

// Layer A-2: trajectory → 시리즈 아크 형태 지시
const TRAJECTORY_ARC_MAP = {
  escalating:          '샷이 갈수록 감정 강도와 긴장감이 높아지는 구조. 초반 잔잔 → 후반 절정. 에너지가 축적되어 마지막 샷에서 터지도록.',
  cooling:             '초반 긴장 또는 강한 감정 → 후반으로 갈수록 해소되고 안정되는 구조. 감정이 점점 가라앉으며 평화로운 랜딩.',
  stable:              '전체 톤을 일관되게 유지. 기복 없이 하나의 감정 온도를 처음부터 끝까지.',
  reversal_possible:   '중간에 감정 전환점이 있는 구조. 초반 A 감정 → 중반 전환 → 후반 B 감정으로 착지. 대비가 극적으로.',
};

// Layer A-3: ARHA VOICE ANCHORS — 채팅과 동일한 한국어 어휘 register 규칙
const NARRATION_VOICE_RULE =
  '나레이션 말투: 나/내가 (저/제가 금지) | 문장 종결 ~야/~어/~지/~네/~겠어 (습니다/입니다 금지) | 친한 친구에게 말하듯 자연스럽게. AI 방송 어체, 고객센터 어체 절대 금지.';

const NARRATION_SYSTEM = `You are a professional Korean scriptwriter specializing in cinematic narration and commercial advertising.

Given a concept, produce a structured video narration script. Output MUST be valid JSON only — no markdown, no explanation.

AD type (광고) structure:
Shot 1: Hook — grabs attention in first 3–5 seconds
Shot 2–3: Story — brand/product narrative, emotional connection
Shot 4: Emotion Peak — the feeling that makes people remember
Shot 5: CTA/Brand — call to action or tagline moment

MOVIE type (영화) structure:
Shot 1: Setting — world establishment
Shot 2: Character — protagonist emotional state
Shot 3: Conflict — tension or turning point
Shot 4: Climax — peak moment
Shot 5: Resolution — emotional landing

For N shots, distribute the structure proportionally.

Output format (pure JSON, no other text):
{
  "consistencyAnchor": "English — shared visual DNA for ALL shots: color grade, camera style, lighting mood, aspect ratio treatment — 1–2 sentences",
  "shots": [
    {
      "index": 1,
      "narration": "Korean narration/voiceover text — apply the tone and register rules given",
      "visualPrompt": "English — what appears on screen: subject, action, camera movement, atmosphere — apply the visual grammar given",
      "duration": 8
    }
  ]
}

Rules:
- narration: Korean — strictly follow the tone style and voice register injected below
- visualPrompt: English, cinematic, specific — include motion (slow push-in, pan, rack focus etc.) + apply visual grammar injected below
- duration: seconds per shot; AD shots sum to ~60s total; MOVIE is flexible
- consistencyAnchor: ensures all clips look like ONE cohesive piece (same color, same mood, same camera style)`;

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { concept, type = 'ad', shotCount = 5, expressionMode, trajectory } = req.body ?? {};
  if (!concept?.trim()) return res.status(400).json({ error: 'concept required' });

  const shots = Math.min(Math.max(parseInt(shotCount) || 5, 1), 10);

  const typeLabel = type === 'ad'
    ? '광고 (60-second commercial)'
    : '영화 (cinematic short film)';

  // Layer A: 함수언어체계 expressionMode + trajectory 주입
  const toneLine = expressionMode && EXPRESSION_NARRATION_MAP[expressionMode]
    ? `\n[Narration Tone — expressionMode: ${expressionMode}]\n${EXPRESSION_NARRATION_MAP[expressionMode]}`
    : '';
  const arcLine = trajectory && TRAJECTORY_ARC_MAP[trajectory]
    ? `\n[Series Arc — trajectory: ${trajectory}]\n${TRAJECTORY_ARC_MAP[trajectory]}`
    : '';
  const voiceLine = `\n[Voice Register]\n${NARRATION_VOICE_RULE}`;

  const userMsg = `Concept: "${concept.trim()}"
Type: ${typeLabel}
Number of shots: ${shots}
${toneLine}${arcLine}${voiceLine}

Write the narration script now.`;

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key':         process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
      'content-type':      'application/json',
    },
    body: JSON.stringify({
      model:      'claude-sonnet-4-20250514',
      max_tokens: 4096,
      // expressionMode → temperature 이식 (채팅 파이프라인과 동일한 값)
      temperature: {
        ANALYTIC_THINK:  0.3,
        DEEP_EMPATHY:    0.75,
        REFLECTIVE_GROW: 0.85,
        SERENE_SMILE:    0.7,
        SOFT_WARMTH:     0.9,
        PLAYFUL_TEASE:   0.95,
        INTENSE_JOY:     1.0,
      }[expressionMode] ?? 0.85,
      system:     NARRATION_SYSTEM,
      messages:   [{ role: 'user', content: userMsg }],
    }),
  });

  if (!response.ok) {
    const errBody = await response.text();
    console.error('Anthropic narration error:', response.status, errBody);
    return res.status(response.status).json({ error: `Anthropic API: ${response.status}` });
  }

  const data = await response.json();
  const raw  = data.content?.find(c => c.type === 'text')?.text ?? '';

  // Strip markdown code fences if Claude wraps in ```json ... ```
  const jsonStr = raw.replace(/^```(?:json)?\s*/m, '').replace(/\s*```\s*$/m, '').trim();

  try {
    const parsed = JSON.parse(jsonStr);
    // Ensure shots array is present and has correct indices
    if (!parsed.shots || !Array.isArray(parsed.shots)) {
      throw new Error('Missing shots array');
    }
    parsed.shots = parsed.shots.map((s, i) => ({ ...s, index: i + 1 }));
    return res.json(parsed);
  } catch (e) {
    console.error('Narration JSON parse error. Raw:', raw);
    return res.status(500).json({ error: 'Failed to parse narration script', raw });
  }
}
