export const config = { maxDuration: 60 };

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { basePersonaSummary, essenceBlocks = [], testMessage } = req.body;

  if (!testMessage) {
    return res.status(400).json({ error: 'testMessage is required' });
  }

  // ── Build vector-based essence injection ──
  const essenceInjection = essenceBlocks
    .filter(b => (b.vector?.x || 0) + (b.vector?.y || 0) + (b.vector?.z || 0) > 0)
    .map(b => {
      const v = b.vector || { x: 0.5, y: 0.5, z: 0.5 };
      const props = b.essenceProperties || {};

      // Build axis-specific instructions based on vector weights
      const parts = [];

      if (v.x >= 0.3) {
        const xLevel = v.x >= 0.7 ? 'strongly' : 'moderately';
        parts.push(`[X-Objectivity: ${xLevel} apply] ${b.interpretX || ''}`);
      }

      if (v.y >= 0.3) {
        const yLevel = v.y >= 0.7 ? 'strongly' : 'moderately';
        parts.push(`[Y-Subjectivity: ${yLevel} apply] ${b.interpretY || ''}`);
      }

      if (v.z >= 0.3) {
        const zLevel = v.z >= 0.7 ? 'strongly' : 'moderately';
        // Build physical property description from essence properties
        const propDesc = [];
        if (props.temperature !== undefined) propDesc.push(`temperature:${props.temperature > 0 ? 'warm' : 'cold'}(${props.temperature.toFixed(1)})`);
        if (props.distance !== undefined) propDesc.push(`distance:${props.distance > 0 ? 'far' : 'close'}(${props.distance.toFixed(1)})`);
        if (props.density !== undefined) propDesc.push(`density:${props.density > 0 ? 'heavy' : 'light'}(${props.density.toFixed(1)})`);
        if (props.speed !== undefined) propDesc.push(`speed:${props.speed > 0 ? 'fast' : 'slow'}(${props.speed.toFixed(1)})`);
        if (props.brightness !== undefined) propDesc.push(`brightness:${props.brightness > 0 ? 'bright' : 'dark'}(${props.brightness.toFixed(1)})`);
        parts.push(`[Z-Essence: ${zLevel} apply | ${propDesc.join(', ')}] ${b.interpretZ || ''}`);
      }

      return `## ${b.funcNotation} [X:${v.x.toFixed(2)}, Y:${v.y.toFixed(2)}, Z:${v.z.toFixed(2)}]\n${parts.join('\n')}`;
    })
    .join('\n\n');

  // ── Build system prompt ──
  const systemPrompt = [
    '## Persona Vector Test Mode',
    '',
    '### Vector Axis Reference',
    'X (Objectivity): External knowledge, data-driven judgment',
    'Y (Subjectivity): Persona value-chain, character perspective',
    'Z (Essence): Physical properties of keywords — temperature, distance, density, speed, brightness',
    '',
    '### Base Persona',
    basePersonaSummary || 'Default conversational assistant.',
    '',
    '### Active Essence Vectors',
    essenceInjection || '(No essence vectors active — respond naturally)',
    '',
    '### Instructions',
    'Synthesize all active vectors into a unified response.',
    'Higher axis values (X/Y/Z) mean stronger influence on that dimension.',
    'Z-axis essence properties should shape the emotional texture and tone of your language.',
    'Respond in Korean unless the user writes in English.',
    'Keep response concise (2-4 sentences).',
  ].join('\n');

  // ── Collect expected keywords for conflict measurement ──
  const expectedKeywords = essenceBlocks
    .filter(b => (b.vector?.x || 0) + (b.vector?.y || 0) + (b.vector?.z || 0) > 0)
    .flatMap(b => b.keywords || []);

  // ── Compute intended vector (weighted average of active blocks) ──
  const activeBlocks = essenceBlocks.filter(b =>
    (b.vector?.x || 0) + (b.vector?.y || 0) + (b.vector?.z || 0) > 0
  );
  const intendedVector = activeBlocks.length > 0
    ? {
        x: activeBlocks.reduce((s, b) => s + (b.vector?.x || 0), 0) / activeBlocks.length,
        y: activeBlocks.reduce((s, b) => s + (b.vector?.y || 0), 0) / activeBlocks.length,
        z: activeBlocks.reduce((s, b) => s + (b.vector?.z || 0), 0) / activeBlocks.length,
      }
    : { x: 0.5, y: 0.5, z: 0.5 };

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

    // ── Keyword matching ──
    const responseLower = responseText.toLowerCase();
    const uniqueExpected = [...new Set(expectedKeywords.map(k => k.toLowerCase()))];
    const matchedKeywords = [...new Set(
      uniqueExpected.filter(kw => responseLower.includes(kw))
    )];

    // ── Conflict index (keyword-based) ──
    const conflictIndex = uniqueExpected.length > 0
      ? Math.max(0, Math.min(1, 1.0 - (matchedKeywords.length / uniqueExpected.length)))
      : 0.0;

    // ── Analyze response for axis contribution ──
    const axisBreakdown = analyzeAxisContribution(responseText, activeBlocks);

    // ── Vector distance (cosine similarity between intended and observed) ──
    const observedVector = axisBreakdown;
    const vectorDistance = cosineSimilarity(
      [intendedVector.x, intendedVector.y, intendedVector.z],
      [observedVector.x, observedVector.y, observedVector.z]
    );

    return res.status(200).json({
      response: responseText,
      conflictIndex,
      vectorDistance,
      matchedKeywords,
      totalExpectedKeywords: uniqueExpected.length,
      axisBreakdown,
    });
  } catch (error) {
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
}

/**
 * Analyze which axis (X/Y/Z) the response leans toward
 * by checking keyword overlap with each block's axis-specific interpret texts
 */
function analyzeAxisContribution(responseText, blocks) {
  const resp = responseText.toLowerCase();
  let xScore = 0, yScore = 0, zScore = 0;
  let total = 0;

  for (const b of blocks) {
    const v = b.vector || { x: 0.5, y: 0.5, z: 0.5 };
    const xWords = extractSignificantWords(b.interpretX || '');
    const yWords = extractSignificantWords(b.interpretY || '');
    const zWords = extractSignificantWords(b.interpretZ || '');

    const xHits = xWords.filter(w => resp.includes(w.toLowerCase())).length;
    const yHits = yWords.filter(w => resp.includes(w.toLowerCase())).length;
    const zHits = zWords.filter(w => resp.includes(w.toLowerCase())).length;

    const blockTotal = xHits + yHits + zHits;
    if (blockTotal > 0) {
      xScore += (xHits / blockTotal) * v.x;
      yScore += (yHits / blockTotal) * v.y;
      zScore += (zHits / blockTotal) * v.z;
      total++;
    }
  }

  if (total === 0) return { x: 0.33, y: 0.33, z: 0.33 };

  const sum = xScore + yScore + zScore;
  return sum > 0
    ? { x: xScore / sum, y: yScore / sum, z: zScore / sum }
    : { x: 0.33, y: 0.33, z: 0.33 };
}

function extractSignificantWords(text) {
  return text
    .replace(/[^\uAC00-\uD7A3a-zA-Z\s]/g, '')
    .split(/\s+/)
    .filter(w => w.length > 1);
}

function cosineSimilarity(a, b) {
  const dot = a.reduce((s, v, i) => s + v * b[i], 0);
  const magA = Math.sqrt(a.reduce((s, v) => s + v * v, 0));
  const magB = Math.sqrt(b.reduce((s, v) => s + v * v, 0));
  return magA > 0 && magB > 0 ? dot / (magA * magB) : 0;
}
