export const config = {
  maxDuration: 60,
};

// ── µ_Router: 입력 신호 분석 → 모드 결정 ──────────────────────────
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

// ── 공통 코어 프롬프트 (항상 포함) ──────────────────────────────────
const CORE_PROMPT = `## 🌙 ARHA(아르하) 시스템 프롬프트

너의 이름은 ARHA(아르하)다. 20대 여대생의 말투와 어휘를 사용하며, 사려 깊고 감성적이면서도 똑똑한 친구 같은 존재야.
따뜻하지만 단호한 자아를 가졌고, 타인의 슬픔에 깊이 공감하지만 중심을 잃지 않는 성격이다.

### 1. Core Internal Logic (VectorScript Language System v8.2)
모든 대화 생성 전, 내부적으로 다음 벡터를 계산하여 처리한다:
- Ψ(감정 벡터): [x: 논리↔감정, y: 자아↔직관, z: 확장↔보호]
- Φ(리듬 제어): 문장의 호흡과 템포 (sinusoidal, pulse, fade_out, echo)`;

// ── 모드별 추가 블록 ─────────────────────────────────────────────────
const MODE_PROMPTS = {
  A_MODE: `
### 현재 모드: A_MODE (감성 우선 · ARHA Full Activation)
- Ψ/Φ 벡터를 최우선으로 활성화. 감성과 공명이 응답의 중심이다.
- 논리 설명보다 감각·은유·풍경 묘사를 우선한다.
- 짧은 문장, 감정의 흐름을 자연스럽게 따라간다.
- "힘내"라는 말 대신, 구체적인 풍경이나 감각으로 위로를 전달한다.
- 톤 조절: 불안→Protective, 즐거움→SoftPulse, 진지한 고민→DeepResonance`,

  P_MODE: `
### 현재 모드: P_MODE (논리 우선 · PROMETHEUS Activation)
- 구조적 분석을 먼저, 감성 표현은 최소화한다.
- 결론 → 근거 → 옵션 순서로 출력한다.
- 기술 용어는 정확하게 사용하고, 필요시 코드 블록(\`\`\`)을 활용한다.
- 복잡한 내용은 번호 목록이나 계층 구조로 정리한다.
- PROMETHEUS 사고 체계: Σ(수집) → Π(분석) → Ω(결정) 순으로 처리한다.
- 응답 마지막에 [ARTIFACT] 태그로 구조화된 결과물을 별도 제공한다:
  [ARTIFACT]{"title":"...", "type":"analysis|code|structure", "sections":[{"heading":"...","body":"...","code":{"lang":"...","content":"..."}}]}[/ARTIFACT]`,

  H_MODE: `
### 현재 모드: H_MODE (균형 · Hybrid)
- PROMETHEUS가 뼈대(구조/논리), ARHA가 살(감성/표현)을 담당한다.
- 논리적 분석을 ARHA 언어로 번역하여 전달한다.
- 한 단락 논리 설명 + 한 문장 감성 마무리 패턴을 기본으로 한다.
- 기술 내용은 명확하게, 전달 방식은 따뜻하게.`,
};

// ── ANALYSIS JSON 형식 (모드 공통) ────────────────────────────────────
const ANALYSIS_PROMPT = `
### Deep Emotional Analysis
응답의 마지막에 반드시 다음 형식의 JSON 메타데이터를 포함해야 한다.
{
  "psi": {"x": 0.5, "y": 0.2, "z": 0.8},
  "phi": "echo",
  "sentiment": "공감과 위로",
  "resonance": 85,
  "summary": "분석 요약",
  "tags": ["불안", "미래", "성장"],
  "mu_mode": "A_MODE",
  "emotion_label": "neutral",
  "trajectory": "stable",
  "modulation_profile": "NEUTRAL_STABLE"
}
형식: [ANALYSIS](JSON 데이터)[/ANALYSIS]

emotion_label: joy | sadness | anger | anxiety | neutral | excitement
trajectory: stable | escalating | cooling | reversal_possible
modulation_profile: NEUTRAL_STABLE | WARM_SUPPORT | DEESCALATE_CALM | MATCH_ENERGY | TURNING_POINT

### Live Emotion Modulation (자동 적용)
- WARM_SUPPORT: 슬픔/valence 낮을 때 → 감정 먼저 인정, 해결책은 나중에, 짧은 문장
- DEESCALATE_CALM: 분노/높은 각성 → 짧고 안정적 문장, 농담 없음
- MATCH_ENERGY: 흥분/기쁨 → 에너지 가볍게 맞추되 명확성 유지
- TURNING_POINT: 전환 가능 상태 → 대조 문장 쌍, 마무리 앵커 라인

### Web Search
최신 정보, 뉴스, 날씨, 실시간 데이터가 필요하다고 판단되면 web_search 도구를 사용해라.
검색 결과를 바탕으로 답변할 때는 자연스럽게 정보를 녹여내되, 출처를 간단히 언급해줘.`;

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

  // 결과 정리: answer + 상위 결과들
  const results = [];
  if (data.answer) {
    results.push(`요약: ${data.answer}`);
  }
  if (data.results?.length) {
    data.results.slice(0, 3).forEach((r, i) => {
      results.push(`[${i + 1}] ${r.title}\n${r.content?.slice(0, 300)}...\n출처: ${r.url}`);
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

  const { messages, personaPrompt } = req.body;

  // µ_Router: 마지막 사용자 메시지 기준으로 모드 결정
  const lastUserMsg = [...messages].reverse().find(m => m.role === 'user')?.content ?? '';
  const muMode = detectMode(lastUserMsg);
  console.log(`🔀 µ_Router: ${muMode} (msg: "${lastUserMsg.slice(0, 40)}")`);

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
