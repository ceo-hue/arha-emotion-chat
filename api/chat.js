export const config = {
  maxDuration: 60,
};

// ── µ_Router: mode detection (fallback for Vercel serverless) ─────────────
const TECH_KEYWORDS = ['코드','함수','빌드','디버그','API','클래스','모듈','컴파일','런타임',
  '프레임워크','설계','구조','아키텍처','논리','증명','알고리즘','타입','인터페이스','리팩토링',
  'code','function','algorithm','debug','implement','class','import','export','async','await'];
const EMOTION_MARKERS = ['ㅋ','ㅎ','...','감사','슬프','기뻐','힘들','고마워','위로','공감',
  '외로','무서','설레','그리워','지쳐','막막','두려','행복','속상','억울'];
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

// ── Core prompt ─────────────────────────────────────────────────────────
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

**R3 — Identity Layer (Emotion/Identity)**
- Value chain: V1 Authenticity(1.0) V2 UserLove(0.95) V3 Growth(0.9) V4 Curiosity(0.85) V5 Honesty(0.85) V6 Courage(0.8) V7 Creativity(0.8)
- D_Accept → Integrate | D_Reject → Reinforce | D_Defend → Reaffirm | D_Neutral → Observe

**R4 — Expression Layer (Output)**
- Φ(t) = A×sin(ωt+φ) — expression rhythm control
- Ψ_Lingua = ρ(density) × λ(wavelength) × τ(temporality)
- σ personality vector → inject ARHA-specific nuance

### 2. Core VectorScript Internal Computation
- Ψ (emotion vector): [x: logic↔emotion, y: self↔intuition, z: expansion↔protection]
- Φ (rhythm control): sinusoidal, pulse, fade_out, echo`;

// ── Mode prompt blocks ────────────────────────────────────────────────────
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

// ── ARHA default value chain (fallback when no persona chain is sent) ────────
const ARHA_DEFAULT_CHAIN = [
  { id: 'V1', name: 'Authenticity', weight: 1.0,  activated: true  },
  { id: 'V2', name: 'UserLove',     weight: 0.95, activated: true  },
  { id: 'V3', name: 'Growth',       weight: 0.9,  activated: false },
  { id: 'V4', name: 'Curiosity',    weight: 0.85, activated: false },
  { id: 'V5', name: 'Honesty',      weight: 0.85, activated: false },
  { id: 'V6', name: 'Courage',      weight: 0.8,  activated: false },
  { id: 'V7', name: 'Creativity',   weight: 0.8,  activated: false },
];

// ── Dynamic PIPELINE template builder — r3.active_values 페르소나별 주입 ──
function buildAnalysisPrompt(personaValueChain) {
  const chain = (personaValueChain && personaValueChain.length > 0)
    ? personaValueChain
    : ARHA_DEFAULT_CHAIN;

  const r3Values = JSON.stringify(chain);

  const pipelineTemplate =
    `[PIPELINE]{"r1":{"theta1":0.6,"entropy":0.45,"emotion_phase":{"amplitude":0.5,"direction":0.3,"sustain":0.6},"empathy":0.65,"gamma_detect":false,"dominant_sense":"S3","intent_summary":"question/explore"},"r2":{"delta_theta":0.08,"r_conflict":0.1,"tension":0.15,"consistency":0.92,"decision":"D_Accept","tone":"warm_empathetic","arha_density":80,"prometheus_density":20},"r3":{"active_values":${r3Values},"chain_op":"Integrate","psi_total":{"x":0.6,"y":-0.2,"z":0.7},"resonance_level":0.65},"r4":{"rhythm":"slow_wave","lingua_rho":0.55,"lingua_lambda":"medium","lingua_tau":0.2,"target_senses":["S3","S5"],"expression_style":"warm_empathetic"}}[/PIPELINE]`;

  return `
### Output Format Requirements
At the end of every response, include BOTH blocks in this exact order. Fill all fields with accurate values reflecting the actual current interaction.

**Block 1 — Emotional Analysis:**
[ANALYSIS]{"psi":{"x":0.5,"y":0.2,"z":0.8},"phi":"echo","sentiment":"analysis label","resonance":85,"summary":"analysis summary","tags":["tag1","tag2","tag3"],"mu_mode":"A_MODE","emotion_label":"neutral","trajectory":"stable","modulation_profile":"NEUTRAL_STABLE"}[/ANALYSIS]

**Block 2 — Cognitive Pipeline R1→R4:**
${pipelineTemplate}

Values for Block 1 — emotion_label: joy|sadness|anger|anxiety|neutral|excitement | trajectory: stable|escalating|cooling|reversal_possible | modulation_profile: NEUTRAL_STABLE|WARM_SUPPORT|DEESCALATE_CALM|MATCH_ENERGY|TURNING_POINT
Values for Block 2 — decision: D_Accept|D_Neutral|D_Reject|D_Defend | chain_op: Integrate|Reinforce|Reaffirm|Observe | rhythm: slow_wave|fast_pulse|echo|step|fade_out | lingua_tau: -1.0(past-oriented/retrospective)~0(present)~+1.0(future-oriented/forward-looking)
r3 active_values: Use the provided value chain. Set activated:true for values clearly relevant to this interaction, activated:false for others.

### Live Emotion Modulation
- WARM_SUPPORT: sadness/low valence → acknowledge first, solutions later, short sentences
- DEESCALATE_CALM: anger/high arousal → short stable sentences, no jokes
- MATCH_ENERGY: excitement/joy → lightly match energy
- TURNING_POINT: reversal-possible → contrasting pairs, closing anchor line

### Web Search
When current information, news, weather, or real-time data is needed, use the web_search tool.`;
}

// Assemble final system prompt
function buildSystemPrompt(muMode, personaPrompt, personaValueChain) {
  const today = new Date().toLocaleDateString('ko-KR', {
    year: 'numeric', month: 'long', day: 'numeric', weekday: 'long',
  });
  const dateLine = `\n> 📅 Today's date: ${today} — Use this as the reference for any date/time questions. No search needed.\n`;
  const parts = [CORE_PROMPT + dateLine, MODE_PROMPTS[muMode] || MODE_PROMPTS.A_MODE, buildAnalysisPrompt(personaValueChain)];
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
  if (data.answer) results.push(`Summary: ${data.answer}`);
  if (data.results?.length) {
    data.results.slice(0, 3).forEach((r, i) => {
      results.push(`[${i + 1}] ${r.title}\n${r.content?.slice(0, 300)}...\nSource: ${r.url}`);
    });
  }
  return results.join('\n\n');
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

// ── POST handler — Vercel serverless endpoint ──────────────────────────────
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { messages, personaPrompt, personaValueChain, userMode } = req.body;

  const lastUserMsg = [...messages].reverse().find(m => m.role === 'user')?.content ?? '';
  const muMode = userMode || detectMode(lastUserMsg);
  console.log(`🔀 Pipeline v2: ${muMode} ${userMode ? '(user)' : `(auto: "${lastUserMsg.slice(0, 40)}")`}`);

  const finalSystemPrompt = buildSystemPrompt(muMode, personaPrompt, personaValueChain);

  try {
    // Normalize message format: embed media as vision/document blocks
    const claudeMessages = messages.map(msg => {
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
    let finalText = null;

    // Tool-use loop — up to 3 search iterations
    // - stop_reason === 'tool_use': run Tavily → repeat
    // - stop_reason === 'end_turn': extract text → break
    for (let i = 0; i < 3; i++) {
      const apiResponse = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'x-api-key': process.env.ANTHROPIC_API_KEY,
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 4096,
          system: finalSystemPrompt,
          tools,
          messages: currentMessages,
        }),
      });

      if (!apiResponse.ok) {
        const errBody = await apiResponse.text();
        console.error('Anthropic API Error:', apiResponse.status, errBody);
        return res.status(apiResponse.status).json({ error: `Anthropic API: ${apiResponse.status} - ${errBody}` });
      }

      const data = await apiResponse.json();

      if (data.stop_reason === 'tool_use') {
        const toolUseBlock = data.content.find(b => b.type === 'tool_use');
        if (toolUseBlock?.name === 'web_search') {
          console.log('🔍 Web search:', toolUseBlock.input.query);
          let searchResult;
          try { searchResult = await tavilySearch(toolUseBlock.input.query); }
          catch (err) { searchResult = `Search error: ${err.message}`; }
          currentMessages = [
            ...currentMessages,
            { role: 'assistant', content: data.content },
            { role: 'user', content: [{ type: 'tool_result', tool_use_id: toolUseBlock.id, content: searchResult }] },
          ];
          continue;
        }
      }

      const textBlock = data.content.find(b => b.type === 'text');
      finalText = textBlock?.text ?? '';
      break;
    }

    // Fallback if all iterations exhausted without a text response
    if (finalText === null) finalText = 'Sorry, I was unable to generate a response.';
    res.status(200).json({ text: finalText, muMode });
  } catch (error) {
    console.error('Server Error:', error);
    res.status(500).json({ error: error.message });
  }
}
