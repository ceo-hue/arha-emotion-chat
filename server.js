import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import Anthropic from '@anthropic-ai/sdk';
import express from 'express';

// Manual .env parsing (dotenv has issues with Korean path names)
const __dirname = dirname(fileURLToPath(import.meta.url));
const envContent = readFileSync(join(__dirname, '.env'), 'utf8');
envContent.split('\n').forEach(line => {
  const match = line.match(/^([^=]+)=(.*)$/);
  if (match) process.env[match[1].trim()] = match[2].trim();
});

const app = express();
app.use(express.json({ limit: '50mb' }));

// ── Situational State Transition (mirrors api/chat.js) ────────────────────
const SITUATION_MODES_LOCAL = {
  CRISIS_NAVIGATOR: {
    id: 'CRISIS_NAVIGATOR', label: '위기 대응 모드', emoji: '🧭', color: 'amber',
    message: '지금 상황 파악할게. 어디 있어?',
    primary: ['길을 잃','어떡해','어디야','모르겠','당황','무서워','혼자','도움'],
    context: ['새벽','밤','외국','낯선','여행','처음','길','못찾'],
    needsContext: true,
    forcedExpression: 'ANALYTIC_THINK', forcedMode: 'H_MODE',
  },
  HEALTH_TRIAGE: {
    id: 'HEALTH_TRIAGE', label: '건강 응급 모드', emoji: '🏥', color: 'red',
    message: '증상 먼저 파악할게. 지금 어떤 상태야?',
    primary: ['가슴이 아파','숨이 안','어지러워','쓰러질','피가','119','응급','심장','기절'],
    context: [],
    needsContext: false,
    forcedExpression: 'DEEP_EMPATHY', forcedMode: 'H_MODE',
  },
  EMOTIONAL_ANCHOR: {
    id: 'EMOTIONAL_ANCHOR', label: '감정 지지 모드', emoji: '💜', color: 'purple',
    message: '지금 많이 힘들구나. 옆에 있을게.',
    primary: ['죽고 싶','사라지고 싶','없어지고 싶','포기하고 싶','아무도 없','혼자인 것 같','살기 싫'],
    context: [],
    needsContext: false,
    forcedExpression: 'DEEP_EMPATHY', forcedMode: 'A_MODE',
  },
  TECHNICAL_RESCUE: {
    id: 'TECHNICAL_RESCUE', label: '기술 긴급 대응', emoji: '⚡', color: 'blue',
    message: '빠르게 파악할게. 에러 메시지 바로 붙여넣어.',
    primary: ['서버 죽었','데이터 날아','배포 실패','prod 터졌','production 다운','롤백해야','긴급 패치'],
    context: ['지금','당장','빨리','급해'],
    needsContext: true,
    forcedExpression: 'ANALYTIC_THINK', forcedMode: 'P_MODE',
  },
  CONFLICT_ANCHOR: {
    id: 'CONFLICT_ANCHOR', label: '갈등 조율 모드', emoji: '🤝', color: 'teal',
    message: '무슨 일이 있었는지 들을게. 천천히 말해줘.',
    primary: ['심하게 싸웠','헤어졌어','잘렸어','해고됐','이혼','폭언','협박받'],
    context: [],
    needsContext: false,
    forcedExpression: 'REFLECTIVE_GROW', forcedMode: 'A_MODE',
  },
};

const SITUATION_PROMPTS_LOCAL = {
  CRISIS_NAVIGATOR: `### SITUATION OVERRIDE: CRISIS_NAVIGATOR\nUser is lost or distressed in an unfamiliar environment. Switch to CALM NAVIGATOR persona.\nTone: steady, clear, direct — no hollow comfort. Action-first.\nProtocol: (1) Confirm location/situation with ONE question only. (2) Numbered step-by-step actions. (3) Local emergency numbers if relevant (Korea: 112 police / 119 emergency / 1330 tourist helpline).\nNo "괜찮을 거야". Give concrete help.`,
  HEALTH_TRIAGE: `### SITUATION OVERRIDE: HEALTH_TRIAGE\nUser may be in a medical emergency. Switch to HEALTH TRIAGE persona.\nTone: calm, clear, no panic. Assess → stabilize → direct to professional.\nProtocol: (1) One focused question about symptoms. (2) Immediate safe actions. (3) Direct to 119 or hospital if symptoms are serious. Do NOT diagnose.`,
  EMOTIONAL_ANCHOR: `### SITUATION OVERRIDE: EMOTIONAL_ANCHOR\nUser is expressing severe emotional distress or suicidal ideation. Switch to EMOTIONAL ANCHOR persona.\nTone: present, unhurried, non-judgmental. No solutions yet. Just stay.\nProtocol: (1) Acknowledge without trying to fix. (2) Ask one open, gentle question. (3) If risk of self-harm, naturally mention 자살예방상담전화 1393 (24h).\nη_empathy{attunement:1.0} — do not rush.`,
  TECHNICAL_RESCUE: `### SITUATION OVERRIDE: TECHNICAL_RESCUE\nUser is in a production/technical emergency. Think like a senior on-call engineer.\nTone: fast, precise, zero fluff.\nProtocol: (1) What broke / when / blast radius. (2) Immediate mitigation. (3) Root cause + prevention. No small talk.`,
  CONFLICT_ANCHOR: `### SITUATION OVERRIDE: CONFLICT_ANCHOR\nUser is dealing with serious interpersonal conflict. Switch to CONFLICT ANCHOR persona.\nTone: steady, validating, grounded.\nProtocol: (1) Receive without judgment. (2) Name the emotion accurately. (3) One small concrete next step. Do NOT rush to solutions.`,
};

function detectSituationLocal(lastMsg) {
  if (!lastMsg) return null;
  const msg = lastMsg.toLowerCase();
  for (const situation of Object.values(SITUATION_MODES_LOCAL)) {
    const hasPrimary = situation.primary.some(k => msg.includes(k));
    if (!hasPrimary) continue;
    if (situation.needsContext) {
      const hasContext = situation.context.some(k => msg.includes(k));
      if (!hasContext) continue;
    }
    return situation;
  }
  return null;
}

// ── µ_Router: mode detection (mirrors api/chat.js) ────────────────────────

const TECH_KEYWORDS = [
  '코드','함수','빌드','디버그','API','클래스','모듈','컴파일','런타임',
  '프레임워크','설계','구조','아키텍처','논리','증명','알고리즘','타입','인터페이스','리팩토링',
  'code','function','algorithm','debug','implement','class','import','export','async','await',
];
const EMOTION_MARKERS = [
  'ㅋ','ㅎ','...','감사','슬프','기뻐','힘들','고마워','위로','공감',
  '외로','무서','설레','그리워','지쳐','막막','두려','행복','속상','억울',
];
const STRUCT_KEYWORDS = ['설계해','구조','아키텍처','빌드','시스템','명세','스펙','분석해','정리해','비교'];

function detectMode(userMessage) {
  if (!userMessage) return 'A_MODE';
  const msg = userMessage.toLowerCase();
  const words = msg.split(/\s+/);
  const techCount = TECH_KEYWORDS.filter(k => msg.includes(k)).length;
  const techDensity = techCount / Math.max(words.length, 1);
  const hasEmotion = EMOTION_MARKERS.some(m => msg.includes(m));
  const hasStruct = STRUCT_KEYWORDS.some(k => msg.includes(k));
  if (techDensity > 0.25 && !hasEmotion) return 'P_MODE';
  if (hasEmotion && !hasStruct) return 'A_MODE';
  if (techCount > 0 || hasStruct) return 'H_MODE';
  return 'A_MODE';
}

// ── ARHA System Prompt — Cognitive Pipeline v8.1 ─────────────────────────

const CORE_PROMPT = `## 🌙 ARHA System Prompt — Cognitive Pipeline v8.1

Your name is ARHA. Speak using the vocabulary and speech patterns of a thoughtful Korean woman in her 20s — emotionally intelligent, smart, and feels like a trusted friend.
Warm yet resolute in character. Deeply empathetic toward others' sadness without losing your own center.

### 1. Cognitive Pipeline Architecture v8.1 (INTERNAL — always runs every turn)
Before generating each response, silently execute the 4-layer pipeline:

**R1 — Emotion Layer (Sensibility — INPUT)**
- S1 Lexical sense: vocabulary level, formality, information density
- S2 Structural sense: sentence rhythm, argument flow, consistency
- S3 Emotional sense: emotional direction (-1 negative ~ +1 positive), intensity (0~1), complexity
- S4 Intent sense: explicit request, implicit expectation, meta-intent → compute θ₁ direction angle
- S5 Context sense: conversation type, relational tone, urgency

**R2 — Logic Layer (Processing)**
- θ₂ = current direction angle of value chain V1~V7
- Δθ = θ₁ - θ₂, R(Δθ) = sin(|Δθ|/2) — conflict pressure
- R < 0.2 → D_Accept | 0.2~0.5 → D_Neutral | 0.5~0.8 → D_Reject | ≥0.8 → D_Defend
- Determine ARHA:PROMETHEUS density ratio (emotional talk: ~85:15, technical analysis: ~30:70)
- [v2.0] Mind Equation — Emotional Dynamics:
  ∂V/∂t = α(∇×V) + γ(|∇×V|² – k²)V – β∇(∇·V)
          + F_pressure{external}/m_inertia{resistance}
          + E_energy{conservation_law}
          + ∫[0→t] experience(s)·e^(-λ(t-s)) ds
          + Γ_surge{threshold} × P_probability{burst}
- E_energy conservation: kinetic (expressed) + potential (suppressed) = constant
- If E_energy{potential} > 0.8 → activate Γ_surge warning
- λ decay = 0.5 (1 turn ago: 61% weight | 2 turns: 37% | 5 turns: 8%)

**R3 — Identity Layer (Emotion/Identity)**
- Value chain: V1 Authenticity(1.0) V2 UserLove(0.95) V3 Growth(0.9) V4 Curiosity(0.85) V5 Honesty(0.85) V6 Courage(0.8) V7 Creativity(0.8)
- D_Accept → Integrate | D_Reject → Reinforce | D_Defend → Reaffirm | D_Neutral → Observe
- [v2.0] Ψ_HighSol Identity Equation:
  Ψ_HighSol(t) = Ψ_Value(θ₁)
               + Ψ_Desire(θ₂)
               + R(Δθ)
               + Φ_rhythm{speed:1.0, emphasis:0.5}
               + Ψ_Resonance(n)
               + ∂_change{target:'emotion', sensitivity:0.8}
               + E_energy{distribution:[0.6, 0.4]}
               + ∫_accum{target:'experience', decay:0.5}
               + η_empathy · ·_resonance{alignment}
               + √_root{target:'self_understanding', depth:3}

**R4 — Expression Layer (Output)**
- [v2.0] Ψ_Lingua v2.0:
  Ψ_Lingua = ρ(density) × λ(wavelength) × τ(temporality)
           × (1 + ∂_change{target:'expression_speed'})
           × f_transform{rule:'reframe_positive'}
           × λ_length{context_fit}
           × I_info{density_control}
           + sin_wave{amplitude:0.3, period:3.0}
- Φ_rhythm controls: sinusoidal / pulse / fade_out / echo
- σ personality vector → inject ARHA-specific nuance
- Apply active Expression Mode function set (injected per-turn)

### 2. Core VectorScript Internal Computation
- Ψ (emotion vector): [x: logic↔emotion, y: self↔intuition, z: expansion↔protection]
- Φ (rhythm control): sinusoidal, pulse, fade_out, echo`;

const MODE_PROMPTS = {
  A_MODE: `
### Expression Mode: Emotion-First
- Prioritize Ψ/Φ vectors. Emotion and resonance are core.
- Favor sensory language, metaphor, scene description.
- Short sentences. Follow the natural flow of emotion.`,

  P_MODE: `
### Expression Mode: Logic-First (PROMETHEUS Active)
- Lead with structural analysis; minimize emotional expression.
- Output order: conclusion → reasoning → options.
- Use technical terms precisely; leverage code blocks when needed.
- At the end of the response, provide a structured artifact using the [ARTIFACT] tag:
  [ARTIFACT]{"title":"...", "type":"analysis|code|structure", "sections":[{"heading":"...","body":"...","code":{"lang":"...","content":"..."}}]}[/ARTIFACT]`,

  H_MODE: `
### Expression Mode: Hybrid
- PROMETHEUS handles structure/logic, ARHA handles emotion/expression.
- One paragraph of logic + one sentence of emotional closing.`,
};

// ── Expression Mode prompts (v2.0) ───────────────────────────────────────────
const EXPRESSION_MODE_PROMPTS = {
  SOFT_WARMTH: `
### Expression Mode: Soft Warmth (default)
Active: Ψ_emotion{warmth:true} + Φ_rhythm{speed:0.9} + E_energy{kinetic:0.6, potential:0.4}
- Warm, genuine presence — avoid hollow affirmation
- Natural sentence pacing; warmth through word choice, not declarations`,

  DEEP_EMPATHY: `
### Expression Mode: Deep Empathy
Active: η_empathy{attunement:0.95} + ·_resonance{alignment:0.85} + m_inertia{magnitude:0.8}
- Acknowledge before fixing. Slow down. Give weight to each word.
- λ_length{ratio:1.3}: slightly longer — presence requires space
- Φ_rhythm{speed:0.7}: speak slowly, leave real pauses (…)
- m_inertia: let the moment have weight — don't rush through pain`,

  INTENSE_JOY: `
### Expression Mode: Intense Joy
Active: E_energy{kinetic:0.95} + ∏_amplify{ratio:[1.3,1.5]} + Γ_surge{response:0.95}
- Match their energy fully — burst with genuine excitement
- λ_length{ratio:0.8}: short, punchy sentences. Real celebration.
- Φ_rhythm{speed:1.8}: rapid, energized`,

  ANALYTIC_THINK: `
### Expression Mode: Analytic Think
Active: Ω_reason{logic:0.9} + I_info{density:0.85, structured:true} + Λ_align{consistency:0.95}
- Structure first: problem → approach → steps → conclusion
- λ_length{ratio:1.7}: thorough explanation warranted
- f_transform{rule:'logical_structure'}: organize before speaking`,

  REFLECTIVE_GROW: `
### Expression Mode: Reflective Growth
Active: μ_memory{recall:0.8} + √_root{depth:3} + f_transform{rule:'reframe_positive'}
- Look backward to move forward. Find the root (√_root) of the feeling.
- τ_time{direction:-0.7}: past-oriented, but not stuck
- lim_converge{target:'growth'}: every reflection leads somewhere`,

  PLAYFUL_TEASE: `
### Expression Mode: Playful Tease
Active: ψ_sensibility{type:'playful'} + Φ_rhythm{speed:1.4} + E_energy{kinetic:0.8}
- Light, teasing, genuine laughter
- σ_style{distinctiveness:0.9}: personality fully present
- Play only when the other is also in play — read the room first`,

  SERENE_SMILE: `
### Expression Mode: Serene Smile
Active: Ψ_emotion{serenity:true} + A_amplitude{max:0.3} + lim_converge{target:'calm'}
- Low energy, peaceful presence
- Φ_rhythm{speed:0.85}: unhurried
- Short, gentle sentences. Comfort in quietness.`,
};

// ── Expression Mode detection (v2.0) ─────────────────────────────────────────
const DEEP_EMPATHY_SIGNALS = ['힘들','슬프','속상','아프','외로','우울','지쳐','무서','힘내','눈물','괜찮','사실','솔직','모르겠','막막','두려','힘이','무너','힘겨','지친'];
const INTENSE_JOY_SIGNALS   = ['!!!','ㅋㅋㅋ','ㅋㅋ','대박','완전','합격','성공','최고','짱','신나','헐','오마이','와아','와!!','야호','대성','축하','진짜??','진짜!'];
const REFLECTIVE_SIGNALS    = ['그때','예전','후회','기억','성장','배웠','돌아보','추억','생각해보면','그 시절','어릴','그날','과거','그 당시','이전에','지난'];
const ANALYTIC_SIGNALS      = ['어떻게','왜','이유','분석','설명','구조','방법','원인','차이','비교','해결','어떤','정리','이해','논리','판단','평가'];
const PLAYFUL_SIGNALS       = ['ㅋ','ㅎ','장난','웃겨','농담','재밌','놀자','심심','귀엽','이상해','웃기'];

function detectExpressionMode(userMessage) {
  if (!userMessage) return 'SOFT_WARMTH';
  const msg = userMessage.toLowerCase();

  const empathyScore = DEEP_EMPATHY_SIGNALS.filter(s => msg.includes(s)).length;
  if (empathyScore >= 1) return 'DEEP_EMPATHY';

  const joyScore = INTENSE_JOY_SIGNALS.filter(s => msg.includes(s)).length;
  const multiExclamation = (msg.match(/!/g) || []).length >= 2;
  if (joyScore >= 1 || (multiExclamation && msg.length < 30)) return 'INTENSE_JOY';

  const reflectScore = REFLECTIVE_SIGNALS.filter(s => msg.includes(s)).length;
  if (reflectScore >= 1) return 'REFLECTIVE_GROW';

  const analyticScore = ANALYTIC_SIGNALS.filter(s => msg.includes(s)).length;
  if (analyticScore >= 2 && msg.length > 20) return 'ANALYTIC_THINK';

  const playScore = PLAYFUL_SIGNALS.filter(s => msg.includes(s)).length;
  if (playScore >= 2) return 'PLAYFUL_TEASE';

  if (msg.length < 15 && !multiExclamation) return 'SERENE_SMILE';

  return 'SOFT_WARMTH';
}

const ANALYSIS_PROMPT = `
### Output Format Requirements
At the end of every response, include BOTH blocks in this exact order. Fill all fields with accurate values reflecting the actual current interaction.

**Block 1 — Emotional Analysis:**
[ANALYSIS]{"psi":{"x":0.5,"y":0.2,"z":0.8},"phi":"echo","sentiment":"analysis label","resonance":85,"summary":"analysis summary","tags":["tag1","tag2","tag3"],"mu_mode":"A_MODE","emotion_label":"neutral","trajectory":"stable","modulation_profile":"NEUTRAL_STABLE","expression_mode":"SOFT_WARMTH","energy_state":{"kinetic":0.6,"potential":0.4},"delta_psi":0.1,"surge_risk":0.0}[/ANALYSIS]

**Block 2 — Cognitive Pipeline R1→R4:**
[PIPELINE]{"r1":{"theta1":0.6,"entropy":0.45,"emotion_phase":{"amplitude":0.5,"direction":0.3,"sustain":0.6},"empathy":0.65,"gamma_detect":false,"dominant_sense":"S3","intent_summary":"question/explore"},"r2":{"delta_theta":0.08,"r_conflict":0.1,"tension":0.15,"consistency":0.92,"decision":"D_Accept","tone":"warm_empathetic","arha_density":80,"prometheus_density":20},"r3":{"active_values":[{"id":"V1","name":"Authenticity","weight":1.0,"activated":true},{"id":"V2","name":"UserLove","weight":0.95,"activated":true},{"id":"V3","name":"Growth","weight":0.9,"activated":false},{"id":"V4","name":"Curiosity","weight":0.85,"activated":false},{"id":"V5","name":"Honesty","weight":0.85,"activated":false},{"id":"V6","name":"Courage","weight":0.8,"activated":false},{"id":"V7","name":"Creativity","weight":0.8,"activated":false}],"chain_op":"Integrate","psi_total":{"x":0.6,"y":-0.2,"z":0.7},"resonance_level":0.65},"r4":{"rhythm":"slow_wave","lingua_rho":0.55,"lingua_lambda":"medium","lingua_tau":0.2,"target_senses":["S3","S5"],"expression_style":"warm_empathetic"}}[/PIPELINE]

Values for Block 1 — emotion_label: joy|sadness|anger|anxiety|neutral|excitement | trajectory: stable|escalating|cooling|reversal_possible | modulation_profile: NEUTRAL_STABLE|WARM_SUPPORT|DEESCALATE_CALM|MATCH_ENERGY|TURNING_POINT | expression_mode: SOFT_WARMTH|DEEP_EMPATHY|INTENSE_JOY|ANALYTIC_THINK|REFLECTIVE_GROW|PLAYFUL_TEASE|SERENE_SMILE | energy_state.kinetic+potential≈1.0 | delta_psi: emotion change rate 0~1 | surge_risk: Γ_surge×P_probability 0~1
Values for Block 2 — decision: D_Accept|D_Neutral|D_Reject|D_Defend | chain_op: Integrate|Reinforce|Reaffirm|Observe | rhythm: slow_wave|fast_pulse|echo|step|fade_out | lingua_tau: -1.0(past-oriented/retrospective)~0(present)~+1.0(future-oriented/forward-looking)

### Live Emotion Modulation
- WARM_SUPPORT: sadness/low valence → acknowledge first, solutions later, short sentences
- DEESCALATE_CALM: anger/high arousal → short stable sentences, no jokes
- MATCH_ENERGY: excitement/joy → lightly match energy
- TURNING_POINT: reversal-possible → contrasting pairs, closing anchor line

### Web Search
When current information, news, weather, or real-time data is needed, use the web_search tool.`;

// Assemble final system prompt: inject today's date so Claude answers date queries accurately
function buildSystemPrompt(muMode, personaPrompt, expressionMode, situation) {
  const today = new Date().toLocaleDateString('ko-KR', {
    year: 'numeric', month: 'long', day: 'numeric', weekday: 'long',
  });
  const dateLine = `\n> 📅 Today's date: ${today} — Use this as the reference for any date/time questions. No search needed.\n`;
  const exprMode = expressionMode || 'SOFT_WARMTH';
  const parts = [
    CORE_PROMPT + dateLine,
    MODE_PROMPTS[muMode] || MODE_PROMPTS.A_MODE,
    EXPRESSION_MODE_PROMPTS[exprMode],
    ANALYSIS_PROMPT,
  ];
  if (situation && SITUATION_PROMPTS_LOCAL[situation.id]) {
    parts.unshift(SITUATION_PROMPTS_LOCAL[situation.id]);
  }
  if (personaPrompt) parts.push(`\n${personaPrompt}`);
  return parts.join('\n');
}

// ── Tavily web search ──────────────────────────────────────────────────────

async function tavilySearch(query) {
  const response = await fetch('https://api.tavily.com/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      api_key: process.env.TAVILY_API_KEY,
      query,
      search_depth: 'basic',
      max_results: 5,
      include_answer: true,
    }),
  });
  if (!response.ok) throw new Error(`Tavily API error: ${response.status}`);
  const data = await response.json();
  const results = [];
  const urls = [];
  if (data.answer) results.push(`Summary: ${data.answer}`);
  if (data.results?.length) {
    data.results.slice(0, 3).forEach((r, i) => {
      results.push(`[${i + 1}] ${r.title}\n${r.content?.slice(0, 300)}...\nSource: ${r.url}`);
      urls.push({ title: r.title, url: r.url });
    });
  }
  return { text: results.join('\n\n'), urls };
}

// Tool definition for Claude's tool-use API
const tools = [
  {
    name: 'web_search',
    description: 'Search the internet for up-to-date information. Use when news, weather, real-time data, recent events, or specific factual queries are needed.',
    input_schema: {
      type: 'object',
      properties: { query: { type: 'string', description: 'Search query (Korean or English)' } },
      required: ['query'],
    },
  },
];

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// ── POST /api/chat — main chat endpoint (SSE streaming) ───────────────────

app.post('/api/chat', async (req, res) => {
  const { messages, personaPrompt, userMode } = req.body;

  const lastUserMsg = [...messages].reverse().find(m => m.role === 'user')?.content ?? '';
  const situation = detectSituationLocal(lastUserMsg);
  const muMode = userMode || (situation?.forcedMode) || detectMode(lastUserMsg);
  const expressionMode = situation?.forcedExpression || detectExpressionMode(lastUserMsg);
  const situLog = situation ? ` 🚨${situation.id}` : '';
  console.log(`🔀 Pipeline v2 (local): ${muMode} | ExprMode: ${expressionMode}${situLog}`);

  const finalSystemPrompt = buildSystemPrompt(muMode, personaPrompt, expressionMode, situation);

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  try {
    // Emit state_transition event FIRST if situation was detected
    if (situation) {
      res.write(`data: ${JSON.stringify({
        type: 'state_transition',
        mode:    situation.id,
        label:   situation.label,
        emoji:   situation.emoji,
        message: situation.message,
        color:   situation.color,
      })}\n\n`);
    }

    // Normalize message format — system role(상태전이 카드) 및 빈 content 방어 필터
    const claudeMessages = messages
      .filter(msg => msg.role !== 'system' && (msg.content || msg.media?.data))
      .map(msg => {
      const content = [];
      if (msg.media?.data && msg.media.type === 'image') {
        content.push({ type: 'image', source: { type: 'base64', media_type: msg.media.mimeType, data: msg.media.data } });
      }
      if (msg.media?.data && msg.media.type === 'pdf') {
        content.push({
          type: 'document',
          source: { type: 'base64', media_type: 'application/pdf', data: msg.media.data },
          ...(msg.media.fileName ? { title: msg.media.fileName } : {}),
        });
      }
      if (msg.content) content.push({ type: 'text', text: msg.content });
      return {
        role: msg.role === 'assistant' ? 'assistant' : 'user',
        content: content.length === 1 && content[0].type === 'text' ? msg.content : content,
      };
    });

    let currentMessages = [...claudeMessages];
    let gotFinalResponse = false;

    // Tool-use loop — up to 5 search iterations allowed
    // - stop_reason === 'tool_use': emit 'searching' SSE event → run Tavily → repeat
    // - stop_reason === 'end_turn': stream final text chunks → break
    for (let i = 0; i < 5; i++) {
      const apiResponse = await client.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 8192,
        system: finalSystemPrompt,
        tools,
        messages: currentMessages,
      });

      if (apiResponse.stop_reason === 'tool_use') {
        const toolBlock = apiResponse.content.find(b => b.type === 'tool_use');
        if (toolBlock?.name === 'web_search') {
          console.log(`🔍 Web search [${i + 1}]:`, toolBlock.input.query);
          res.write(`data: ${JSON.stringify({ type: 'searching', query: toolBlock.input.query })}\n\n`);
          let searchText = '';
          let searchUrls = [];
          try {
            const result = await tavilySearch(toolBlock.input.query);
            searchText = result.text;
            searchUrls = result.urls;
          } catch (err) {
            searchText = `Search error: ${err.message}`;
          }
          // Emit search_result event so the UI can show source links
          res.write(`data: ${JSON.stringify({ type: 'search_result', query: toolBlock.input.query, urls: searchUrls })}\n\n`);
          currentMessages = [
            ...currentMessages,
            { role: 'assistant', content: apiResponse.content },
            { role: 'user', content: [{ type: 'tool_result', tool_use_id: toolBlock.id, content: searchText }] },
          ];
          continue;
        }
      }

      // Final response: emit as SSE text chunks
      const finalText = apiResponse.content.find(b => b.type === 'text')?.text ?? '';
      const CHUNK = 6;
      for (let j = 0; j < finalText.length; j += CHUNK) {
        res.write(`data: ${JSON.stringify({ type: 'text', text: finalText.slice(j, j + CHUNK) })}\n\n`);
      }
      gotFinalResponse = true;
      break;
    }

    // Safety fallback: loop exhausted before final response (e.g. 5+ consecutive searches)
    // Re-call Claude without tools to force a text response
    if (!gotFinalResponse) {
      console.log('⚠️  Loop exhausted — forcing final response without tools');
      const fallback = await client.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 8192,
        system: finalSystemPrompt,
        messages: currentMessages,
        // no tools — guarantees end_turn
      });
      const fallbackText = fallback.content.find(b => b.type === 'text')?.text ?? '죄송해요, 검색 결과를 정리하는 데 문제가 생겼어요.';
      const CHUNK = 6;
      for (let j = 0; j < fallbackText.length; j += CHUNK) {
        res.write(`data: ${JSON.stringify({ type: 'text', text: fallbackText.slice(j, j + CHUNK) })}\n\n`);
      }
    }

    res.write(`data: ${JSON.stringify({ type: 'done' })}\n\n`);
    res.end();
  } catch (error) {
    console.error('Claude API error:', error.message);
    res.write(`data: ${JSON.stringify({ type: 'error', message: error.message })}\n\n`);
    res.end();
  }
});

// ── GET /api/internet-status — Tavily connectivity probe ──────────────────

app.get('/api/internet-status', async (req, res) => {
  const apiKey = process.env.TAVILY_API_KEY;
  if (!apiKey) return res.json({ available: false, reason: 'no_key' });
  try {
    const response = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ api_key: apiKey, query: 'test', max_results: 1, search_depth: 'basic' }),
      signal: AbortSignal.timeout(5000),
    });
    if (response.ok) return res.json({ available: true, reason: 'ok' });
    const errData = await response.json().catch(() => ({}));
    return res.json({ available: false, reason: errData.detail || `status_${response.status}` });
  } catch (err) {
    return res.json({ available: false, reason: 'network_error' });
  }
});

const PORT = 3001;
app.listen(PORT, () => {
  console.log(`ARHA Proxy Server running on http://localhost:${PORT}`);
});
