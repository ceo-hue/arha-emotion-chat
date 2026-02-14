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
`;

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { messages } = req.body;

  try {
    const claudeMessages = messages.map(msg => {
      const content = [];

      if (msg.media?.data && msg.media.type === 'image') {
        content.push({
          type: 'image',
          source: {
            type: 'base64',
            media_type: msg.media.mimeType,
            data: msg.media.data,
          }
        });
      }

      if (msg.content) {
        content.push({ type: 'text', text: msg.content });
      }

      return {
        role: msg.role === 'assistant' ? 'assistant' : 'user',
        content: content.length === 1 && content[0].type === 'text' ? msg.content : content
      };
    });

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
        system: SYSTEM_PROMPT,
        messages: claudeMessages,
      }),
    });

    if (!apiResponse.ok) {
      const errBody = await apiResponse.text();
      console.error('Anthropic API Error:', apiResponse.status, errBody);
      return res.status(apiResponse.status).json({ error: `Anthropic API: ${apiResponse.status} - ${errBody}` });
    }

    const data = await apiResponse.json();
    const fullText = data.content[0].text;

    res.status(200).json({ text: fullText });
  } catch (error) {
    console.error('Server Error:', error);
    res.status(500).json({ error: error.message });
  }
}
