export const config = { maxDuration: 60 };

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { basePersonaSummary, essenceBlocks = [], testMessage } = req.body;

  if (!testMessage) {
    return res.status(400).json({ error: 'testMessage is required' });
  }

  // Build essence injection text
  const essenceInjection = essenceBlocks
    .filter(b => b.weight > 0)
    .map(b => {
      const influence = b.weight >= 0.7 ? 'strong' : b.weight >= 0.4 ? 'moderate' : 'subtle';
      return `[Essence: ${b.nameEn} | influence: ${influence} (${b.weight.toFixed(2)})] ${b.functionLanguage}`;
    })
    .join('\n');

  // Build system prompt
  const systemPrompt = [
    '## Persona Test Mode',
    '',
    '### Base Persona',
    basePersonaSummary || 'Default conversational assistant.',
    '',
    '### Active Essence Blocks',
    essenceInjection || '(No essence blocks active — respond naturally)',
    '',
    '### Instructions',
    'Respond to the user message incorporating the persona tone and essence blocks.',
    'Higher-influence essences should be more prominently reflected in your response.',
    'Respond in Korean unless the user writes in English.',
    'Keep response concise (2-4 sentences).',
  ].join('\n');

  // Collect expected keywords for conflict index
  const expectedKeywords = essenceBlocks
    .filter(b => b.weight > 0)
    .flatMap(b => extractKeywords(b.functionLanguage));

  try {
    const apiResponse = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1024,
        system: systemPrompt,
        messages: [{ role: 'user', content: testMessage }],
      }),
    });

    if (!apiResponse.ok) {
      const errBody = await apiResponse.text();
      return res.status(apiResponse.status).json({ error: errBody });
    }

    const data = await apiResponse.json();
    const responseText = data.content?.find(b => b.type === 'text')?.text ?? '';

    // Calculate conflict index
    const responseLower = responseText.toLowerCase();
    const matchedKeywords = [...new Set(
      expectedKeywords.filter(kw => responseLower.includes(kw.toLowerCase()))
    )];
    const uniqueExpected = [...new Set(expectedKeywords)];
    const conflictIndex = uniqueExpected.length > 0
      ? Math.max(0, Math.min(1, 1.0 - (matchedKeywords.length / uniqueExpected.length)))
      : 0.0;

    return res.status(200).json({
      response: responseText,
      conflictIndex,
      matchedKeywords,
      totalExpectedKeywords: uniqueExpected.length,
    });
  } catch (error) {
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
}

function extractKeywords(text) {
  const stopWords = new Set([
    'the', 'a', 'an', 'is', 'are', 'to', 'of', 'and', 'in', 'for', 'with',
    'that', 'this', 'be', 'as', 'by', 'on', 'at', 'or', 'not', 'use', 'your',
    'from', 'their', 'than', 'when', 'each', 'into', 'over', 'should', 'never',
  ]);
  return text
    .toLowerCase()
    .replace(/[^a-z\s]/g, '')
    .split(/\s+/)
    .filter(w => w.length > 3 && !stopWords.has(w));
}
