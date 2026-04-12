/**
 * /api/persona-analyze — 캐릭터명/모호한 설명 → Claude 분석 → 7D 벡터 + 성격 특성
 *
 * POST { description: string }
 * Response: { trait_description, keywords, axis_values, vector_7d, tone_brief, emoji }
 */

import Anthropic from '@anthropic-ai/sdk';

export const config = { maxDuration: 30 };

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const SYSTEM = `당신은 ARHA 페르소나 시스템의 캐릭터 분석기입니다.
입력된 캐릭터명 또는 설명을 분석하여 ARHA 함수언어 미들웨어에 적용할 성격 특성을 추출합니다.

반드시 아래 JSON 형식으로만 응답하세요:
{
  "character_name": "인식된 캐릭터/페르소나 이름",
  "trait_description": "한국어 성격 요약 (2-3문장, 채팅 페르소나로 표현할 핵심 특성)",
  "keywords": ["성격 키워드 배열", "한국어 또는 영어", "6-10개"],
  "axis_values": {
    "warmth":        0.0~1.0,
    "sincerity":     0.0~1.0,
    "playfulness":   0.0~1.0,
    "assertiveness": 0.0~1.0,
    "depth":         0.0~1.0,
    "formality":     0.0~1.0
  },
  "vector_7d": {
    "I": 0.0~1.0,
    "D": 0.0~1.0,
    "E": 0.0~1.0,
    "T": 0.0~1.0,
    "S": 0.0~1.0,
    "C": 0.0~1.0,
    "R": 0.0~1.0
  },
  "tone_brief": "이 캐릭터의 말투/어조를 한 줄로 (채팅 응답 방식 지시)",
  "emoji": "가장 어울리는 단일 이모지"
}

7D 벡터 의미:
- I (Certainty): 확신도, 주장 강도. 냉철/자신감 있으면 높음.
- D (Density): 의미 농밀도. 깊이 있고 복잡하면 높음.
- E (Entropy): 감정 개방성, 예측 불가능성. 혼돈/활발하면 높음.
- T (Temporality): 시간 흐름 감각. 느리고 깊으면 높음, 빠르고 즉흥적이면 낮음.
- S (Sociality): 사회적 개방도. 친근하고 관계 지향이면 높음.
- C (Coherence): 일관성. 논리적이고 일관되면 높음.
- R (Relativity): 맥락 의존도. 상황에 따라 달라지면 높음.

실제 캐릭터라면 그 캐릭터의 알려진 성격, 말투, 행동 패턴을 정확히 반영하세요.
모호한 설명이라면 그 설명에서 최대한 구체적인 특성을 추론하세요.`;

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { description } = req.body || {};
  if (!description?.trim()) return res.status(400).json({ error: 'description required' });

  try {
    const msg = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1000,
      system: SYSTEM,
      messages: [{ role: 'user', content: `캐릭터/페르소나 분석: "${description.trim()}"` }],
    });

    const text = msg.content[0]?.text || '{}';
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('No JSON in response');

    const parsed = JSON.parse(jsonMatch[0]);
    res.status(200).json(parsed);
  } catch (err) {
    console.error('[persona-analyze]', err);
    res.status(500).json({ error: err.message || 'Analysis failed' });
  }
}
