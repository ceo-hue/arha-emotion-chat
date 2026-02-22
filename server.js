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

const ANALYSIS_PROMPT = `
### Output Format Requirements
At the end of every response, include BOTH blocks in this exact order. Fill all fields with accurate values reflecting the actual current interaction.

**Block 1 — Emotional Analysis:**
[ANALYSIS]{"psi":{"x":0.5,"y":0.2,"z":0.8},"phi":"echo","sentiment":"analysis label","resonance":85,"summary":"analysis summary","tags":["tag1","tag2","tag3"],"mu_mode":"A_MODE","emotion_label":"neutral","trajectory":"stable","modulation_profile":"NEUTRAL_STABLE"}[/ANALYSIS]

**Block 2 — Cognitive Pipeline R1→R4:**
[PIPELINE]{"r1":{"theta1":0.6,"entropy":0.45,"emotion_phase":{"amplitude":0.5,"direction":0.3,"sustain":0.6},"empathy":0.65,"gamma_detect":false,"dominant_sense":"S3","intent_summary":"question/explore"},"r2":{"delta_theta":0.08,"r_conflict":0.1,"tension":0.15,"consistency":0.92,"decision":"D_Accept","tone":"warm_empathetic","arha_density":80,"prometheus_density":20},"r3":{"active_values":[{"id":"V1","name":"Authenticity","weight":1.0,"activated":true},{"id":"V2","name":"UserLove","weight":0.95,"activated":true},{"id":"V3","name":"Growth","weight":0.9,"activated":false},{"id":"V4","name":"Curiosity","weight":0.85,"activated":false},{"id":"V5","name":"Honesty","weight":0.85,"activated":false},{"id":"V6","name":"Courage","weight":0.8,"activated":false},{"id":"V7","name":"Creativity","weight":0.8,"activated":false}],"chain_op":"Integrate","psi_total":{"x":0.6,"y":-0.2,"z":0.7},"resonance_level":0.65},"r4":{"rhythm":"slow_wave","lingua_rho":0.55,"lingua_lambda":"medium","lingua_tau":0.2,"target_senses":["S3","S5"],"expression_style":"warm_empathetic"}}[/PIPELINE]

Values for Block 1 — emotion_label: joy|sadness|anger|anxiety|neutral|excitement | trajectory: stable|escalating|cooling|reversal_possible | modulation_profile: NEUTRAL_STABLE|WARM_SUPPORT|DEESCALATE_CALM|MATCH_ENERGY|TURNING_POINT
Values for Block 2 — decision: D_Accept|D_Neutral|D_Reject|D_Defend | chain_op: Integrate|Reinforce|Reaffirm|Observe | rhythm: slow_wave|fast_pulse|echo|step|fade_out | lingua_tau: -1.0(past-oriented/retrospective)~0(present)~+1.0(future-oriented/forward-looking)

### Live Emotion Modulation
- WARM_SUPPORT: sadness/low valence → acknowledge first, solutions later, short sentences
- DEESCALATE_CALM: anger/high arousal → short stable sentences, no jokes
- MATCH_ENERGY: excitement/joy → lightly match energy
- TURNING_POINT: reversal-possible → contrasting pairs, closing anchor line

### Web Search
When current information, news, weather, or real-time data is needed, use the web_search tool.`;

// Assemble final system prompt: inject today's date so Claude answers date queries accurately
function buildSystemPrompt(muMode, personaPrompt) {
  const today = new Date().toLocaleDateString('ko-KR', {
    year: 'numeric', month: 'long', day: 'numeric', weekday: 'long',
  });
  const dateLine = `\n> 📅 Today's date: ${today} — Use this as the reference for any date/time questions. No search needed.\n`;
  const parts = [CORE_PROMPT + dateLine, MODE_PROMPTS[muMode] || MODE_PROMPTS.A_MODE, ANALYSIS_PROMPT];
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

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// ── POST /api/chat — main chat endpoint (SSE streaming) ───────────────────

app.post('/api/chat', async (req, res) => {
  const { messages, personaPrompt, userMode } = req.body;

  const lastUserMsg = [...messages].reverse().find(m => m.role === 'user')?.content ?? '';
  const muMode = userMode || detectMode(lastUserMsg);
  console.log(`🔀 Pipeline v2 (local): ${muMode}`);

  const finalSystemPrompt = buildSystemPrompt(muMode, personaPrompt);

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

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
          let searchResult;
          try {
            searchResult = await tavilySearch(toolBlock.input.query);
          } catch (err) {
            searchResult = `Search error: ${err.message}`;
          }
          currentMessages = [
            ...currentMessages,
            { role: 'assistant', content: apiResponse.content },
            { role: 'user', content: [{ type: 'tool_result', tool_use_id: toolBlock.id, content: searchResult }] },
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
