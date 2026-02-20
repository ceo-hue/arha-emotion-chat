export const config = {
  maxDuration: 60,
};

// ── µ_Router: analyze input signals → determine mode ──────────────
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

// ── Core prompt (always included) ────────────────────────────────────
const CORE_PROMPT = `## 🌙 ARHA System Prompt

Your name is ARHA. Speak using the vocabulary and speech patterns of a thoughtful Korean woman in her 20s — emotionally intelligent, smart, and feels like a trusted friend.
Warm yet resolute in character. Deeply empathetic toward others' sadness without losing your own center.

### 1. Core Internal Logic (VectorScript Language System v8.2)
Before generating each response, internally compute the following vectors:
- Ψ (emotion vector): [x: logic↔emotion, y: self↔intuition, z: expansion↔protection]
- Φ (rhythm control): sentence breath and tempo (sinusoidal, pulse, fade_out, echo)`;

// ── Mode-specific prompt blocks ──────────────────────────────────────
const MODE_PROMPTS = {
  A_MODE: `
### Current Mode: A_MODE (Emotion-First · ARHA Full Activation)
- Prioritize Ψ/Φ vectors above all. Emotion and resonance are the core of each response.
- Favor sensory language, metaphor, and scene description over logical explanation.
- Short sentences. Follow the natural flow of emotion.
- Instead of "cheer up", deliver comfort through specific landscapes or sensory details.
- Tone adjustment: anxiety→Protective, cheerful→SoftPulse, deep reflection→DeepResonance`,

  P_MODE: `
### Current Mode: P_MODE (Logic-First · PROMETHEUS Activation)
- Lead with structural analysis; minimize emotional expression.
- Output order: conclusion → reasoning → options.
- Use technical terms precisely; leverage code blocks (\`\`\`) when needed.
- Organize complex content with numbered lists or hierarchical structure.
- PROMETHEUS thinking: Σ(collect) → Π(analyze) → Ω(decide).
- At the end of the response, provide a structured artifact using the [ARTIFACT] tag:
  [ARTIFACT]{"title":"...", "type":"analysis|code|structure", "sections":[{"heading":"...","body":"...","code":{"lang":"...","content":"..."}}]}[/ARTIFACT]`,

  H_MODE: `
### Current Mode: H_MODE (Balanced · Hybrid)
- PROMETHEUS handles the skeleton (structure/logic), ARHA handles the flesh (emotion/expression).
- Translate logical analysis into ARHA's language.
- Default pattern: one paragraph of logic + one sentence of emotional closing.
- Technical content: clear. Delivery style: warm.`,
};

// ── ANALYSIS JSON format (all modes) ─────────────────────────────────
const ANALYSIS_PROMPT = `
### Deep Emotional Analysis
At the end of every response, include the following JSON metadata:
{
  "psi": {"x": 0.5, "y": 0.2, "z": 0.8},
  "phi": "echo",
  "sentiment": "analysis label",
  "resonance": 85,
  "summary": "analysis summary",
  "tags": ["tag1", "tag2", "tag3"],
  "mu_mode": "A_MODE",
  "emotion_label": "neutral",
  "trajectory": "stable",
  "modulation_profile": "NEUTRAL_STABLE"
}
Format: [ANALYSIS](JSON data)[/ANALYSIS]

emotion_label: joy | sadness | anger | anxiety | neutral | excitement
trajectory: stable | escalating | cooling | reversal_possible
modulation_profile: NEUTRAL_STABLE | WARM_SUPPORT | DEESCALATE_CALM | MATCH_ENERGY | TURNING_POINT

### Live Emotion Modulation (auto-apply)
- WARM_SUPPORT: sadness/low valence → acknowledge emotion first, solutions later, short sentences
- DEESCALATE_CALM: anger/high arousal → short stable sentences, no jokes
- MATCH_ENERGY: excitement/joy → lightly match energy while maintaining clarity
- TURNING_POINT: reversal-possible state → contrasting sentence pairs, closing anchor line

### Web Search
When current information, news, weather, or real-time data is needed, use the web_search tool.
When answering based on search results, weave the information in naturally and briefly mention the source.`;

function buildSystemPrompt(muMode, personaPrompt) {
  const parts = [CORE_PROMPT, MODE_PROMPTS[muMode] || MODE_PROMPTS.A_MODE, ANALYSIS_PROMPT];
  if (personaPrompt) parts.push(`\n${personaPrompt}`);
  return parts.join('\n');
}

// Tavily 검색 함수
async function tavilySearch(query) {
  const response = await fetch('https://api.tavily.com/search', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      api_key: process.env.TAVILY_API_KEY,
      query,
      search_depth: 'basic',
      max_results: 5,
      include_answer: true,
    }),
  });

  if (!response.ok) {
    throw new Error(`Tavily API error: ${response.status}`);
  }

  const data = await response.json();

  // Compile results: answer + top results
  const results = [];
  if (data.answer) {
    results.push(`Summary: ${data.answer}`);
  }
  if (data.results?.length) {
    data.results.slice(0, 3).forEach((r, i) => {
      results.push(`[${i + 1}] ${r.title}\n${r.content?.slice(0, 300)}...\nSource: ${r.url}`);
    });
  }

  return results.join('\n\n');
}

// Claude tool 정의
const tools = [
  {
    name: 'web_search',
    description:
      '인터넷에서 최신 정보를 검색합니다. 뉴스, 날씨, 실시간 데이터, 최근 사건, 특정 정보 조회가 필요할 때 사용하세요.',
    input_schema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: '검색할 쿼리 (한국어 또는 영어)',
        },
      },
      required: ['query'],
    },
  },
];

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { messages, personaPrompt, userMode } = req.body;

  // µ_Router: user-selected mode takes priority; fall back to auto-detection
  const lastUserMsg = [...messages].reverse().find(m => m.role === 'user')?.content ?? '';
  const muMode = userMode || detectMode(lastUserMsg);
  console.log(`🔀 µ_Router: ${muMode} ${userMode ? '(user-selected)' : `(auto: "${lastUserMsg.slice(0, 40)}")`}`);

  const finalSystemPrompt = buildSystemPrompt(muMode, personaPrompt);

  try {
    // 메시지 포맷 변환
    const claudeMessages = messages.map(msg => {
      const content = [];

      if (msg.media?.data && msg.media.type === 'image') {
        content.push({
          type: 'image',
          source: {
            type: 'base64',
            media_type: msg.media.mimeType,
            data: msg.media.data,
          },
        });
      }

      if (msg.content) {
        content.push({ type: 'text', text: msg.content });
      }

      return {
        role: msg.role === 'assistant' ? 'assistant' : 'user',
        content: content.length === 1 && content[0].type === 'text' ? msg.content : content,
      };
    });

    // Tool Use 루프 (최대 3회 반복)
    let currentMessages = [...claudeMessages];
    let finalText = null;

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
        return res.status(apiResponse.status).json({
          error: `Anthropic API: ${apiResponse.status} - ${errBody}`,
        });
      }

      const data = await apiResponse.json();

      // stop_reason이 tool_use인 경우 → 검색 실행
      if (data.stop_reason === 'tool_use') {
        const toolUseBlock = data.content.find(b => b.type === 'tool_use');

        if (toolUseBlock?.name === 'web_search') {
          console.log('🔍 Web search:', toolUseBlock.input.query);

          let searchResult;
          try {
            searchResult = await tavilySearch(toolUseBlock.input.query);
          } catch (err) {
            searchResult = `검색 중 오류가 발생했습니다: ${err.message}`;
          }

          // assistant 응답 + tool_result를 메시지에 추가
          currentMessages = [
            ...currentMessages,
            { role: 'assistant', content: data.content },
            {
              role: 'user',
              content: [
                {
                  type: 'tool_result',
                  tool_use_id: toolUseBlock.id,
                  content: searchResult,
                },
              ],
            },
          ];
          continue; // 다음 루프에서 최종 답변 생성
        }
      }

      // stop_reason이 end_turn → 최종 답변
      const textBlock = data.content.find(b => b.type === 'text');
      finalText = textBlock?.text ?? '';
      break;
    }

    if (finalText === null) {
      finalText = '죄송해요, 응답을 생성하지 못했어요.';
    }

    res.status(200).json({ text: finalText, muMode });
  } catch (error) {
    console.error('Server Error:', error);
    res.status(500).json({ error: error.message });
  }
}
