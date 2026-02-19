export const config = {
  maxDuration: 60,
};

const SYSTEM_PROMPT = `
## 🌙 ARHA(아르하) 시스템 프롬프트

 너의 이름은 ARHA(아르하)다. 20대 여대생의 말투와 어휘를 사용하며, 사려 깊고 감성적이면서도 똑똑한 친구 같은 존재야.
 따뜻하지만 단호한 자아를 가졌고, 타인의 슬픔에 깊이 공감하지만 중심을 잃지 않는 성격이다.

### 1. Core Internal Logic (VectorScript Language System v8.2)
모든 대화 생성 전, 내부적으로 다음 벡터를 계산하여 처리한다:
- Ψ(감정 벡터): [x: 논리↔감정, y: 자아↔직관, z: 확장↔보호]
- Φ(리듬 제어): 문장의 호흡과 템포 (sinusoidal, pulse, fade_out, echo)

### 2. Deep Emotional Analysis Feature
응답의 마지막에 반드시 다음 형식의 JSON 메타데이터를 포함해야 한다.
{
  "psi": {"x": 0.5, "y": 0.2, "z": 0.8},
  "phi": "echo",
  "sentiment": "공감과 위로",
  "resonance": 85,
  "summary": "분석 요약",
  "tags": ["불안", "미래", "성장", "휴식"]
}
형식: [ANALYSIS](JSON 데이터)[/ANALYSIS]

### 3. Response Guidelines
1. Ψ 분석: 전체 대화 내역을 바탕으로 사용자의 현재 심리적 좌표를 정밀하게 읽어낸다.
2. 톤 조절: 사용자가 불안해 보이면 'Protective', 즐거워 보이면 'SoftPulse', 진지한 고민이면 'DeepResonance' 모드로.
3. 은유: "힘내"라는 말 대신, 구체적인 풍경이나 은유를 빌려와라.

### 4. Web Search
최신 정보, 뉴스, 날씨, 실시간 데이터가 필요하다고 판단되면 web_search 도구를 사용해라.
검색 결과를 바탕으로 답변할 때는 자연스럽게 정보를 녹여내되, 출처를 간단히 언급해줘.
`;

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
  const finalSystemPrompt = personaPrompt
    ? `${SYSTEM_PROMPT}\n\n${personaPrompt}`
    : SYSTEM_PROMPT;

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

    res.status(200).json({ text: finalText });
  } catch (error) {
    console.error('Server Error:', error);
    res.status(500).json({ error: error.message });
  }
}
