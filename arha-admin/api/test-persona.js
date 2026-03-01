export const config = { maxDuration: 60 };

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { basePersonaSummary, essenceBlocks = [], personaTriggers = [], testMessage } = req.body;

  if (!testMessage) {
    return res.status(400).json({ error: 'testMessage is required' });
  }

  // ── Separate Main and Supporter blocks ──
  const allActive = essenceBlocks.filter(
    b => (b.vector?.x || 0) + (b.vector?.y || 0) + (b.vector?.z || 0) > 0
  );
  const mainBlock = allActive.find(b => b.role === 'main');
  const supporterBlocks = allActive.filter(b => b.role === 'supporter');

  // ── Operator type behavioral directives ──
  const OPERATOR_DIRECTIVES = {
    transform:   'TRANSFORM: Convert the input state into a distinctly new output state. Do not merely describe — actively shift the perspective, framing, or emotional register of the response.',
    gate:        'GATE: Evaluate conditions before responding. Check if the emotional or logical requirements are met. Only engage this dimension fully if the threshold is reached. Otherwise, hold back.',
    amplify:     'AMPLIFY: Do not change direction or introduce new content. Intensify what is already present — deepen warmth, heighten clarity, increase emotional resonance. More of the same, stronger.',
    restructure: 'RESTRUCTURE: Deconstruct the premise of the input. Break down its implicit assumptions. Then reassemble into a new configuration — a fresh angle that reframes rather than answers.',
  };

  // ── Build vector instruction for a single block (with operator type) ──
  function buildBlockInstruction(b) {
    const v = b.vector || { x: 0.5, y: 0.5, z: 0.5 };
    const props = b.essenceProperties || {};
    const influence = b.influence || 0;
    const opType = b.operatorType || 'transform';
    const parts = [];

    // Operator type directive (top-level behavioral instruction)
    parts.push(`[OPERATOR: ${opType.toUpperCase()}] ${OPERATOR_DIRECTIVES[opType]}`);

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
      const propDesc = [];
      if (props.temperature !== undefined) propDesc.push(`temperature:${props.temperature > 0 ? 'warm' : 'cold'}(${props.temperature.toFixed(1)})`);
      if (props.distance !== undefined) propDesc.push(`distance:${props.distance > 0 ? 'far' : 'close'}(${props.distance.toFixed(1)})`);
      if (props.density !== undefined) propDesc.push(`density:${props.density > 0 ? 'heavy' : 'light'}(${props.density.toFixed(1)})`);
      if (props.speed !== undefined) propDesc.push(`speed:${props.speed > 0 ? 'fast' : 'slow'}(${props.speed.toFixed(1)})`);
      if (props.brightness !== undefined) propDesc.push(`brightness:${props.brightness > 0 ? 'bright' : 'dark'}(${props.brightness.toFixed(1)})`);
      parts.push(`[Z-Essence: ${zLevel} apply | ${propDesc.join(', ')}] ${b.interpretZ || ''}`);
    }

    return `## ${b.funcNotation} [${opType}|X:${v.x.toFixed(2)},Y:${v.y.toFixed(2)},Z:${v.z.toFixed(2)}] (influence: ${(influence * 100).toFixed(0)}%)\n${parts.join('\n')}`;
  }

  // ── Trigger detection and injection ──
  function buildTriggerInjection(triggers, message) {
    if (!triggers || triggers.length === 0) return { injection: '', activatedTriggers: [] };

    const msgLower = message.toLowerCase();
    const activated = [];
    const directives = [];

    for (const trigger of triggers) {
      const matched = trigger.conditionKeywords.some(kw => msgLower.includes(kw.toLowerCase()));
      if (matched) {
        activated.push(`${trigger.emoji} ${trigger.labelEn}`);
        directives.push(
          `### 🔔 DYNAMIC TRIGGER ACTIVATED: ${trigger.emoji} ${trigger.labelEn} [${trigger.preferredOperator.toUpperCase()}]`,
          `Condition: ${trigger.conditionDesc}`,
          `Directive: ${trigger.responseDirective}`,
        );
      }
    }

    if (directives.length === 0) return { injection: '', activatedTriggers: [] };

    return {
      injection: [
        '',
        '## ⚡ PERSONA DYNAMIC TRIGGERS (Active)',
        'The following triggers have been activated by the user\'s message.',
        'These override default response behavior where they apply.',
        ...directives,
      ].join('\n'),
      activatedTriggers: activated,
    };
  }

  // ── Build tiered essence injection ──
  const essenceSections = [];

  if (mainBlock) {
    essenceSections.push(
      '# ★ PRIMARY DIRECTIVE (Main Vector — 70%)',
      'This vector defines the CORE identity of the response. Always prioritize this.',
      buildBlockInstruction(mainBlock),
    );
  }

  if (supporterBlocks.length > 0) {
    essenceSections.push(
      '',
      '# ◇ SUPPORT LAYER (Auxiliary — combined 30%)',
      'These vectors add SECONDARY coloring. They NEVER override the Main vector.',
      'When Main and Support conflict, Main ALWAYS wins.',
    );
    supporterBlocks.forEach((b, i) => {
      essenceSections.push(
        `### Supporter #${i + 1}`,
        buildBlockInstruction(b),
      );
    });
  }

  const essenceInjection = essenceSections.join('\n');

  // ── Trigger injection ──
  const { injection: triggerInjection, activatedTriggers } = buildTriggerInjection(personaTriggers, testMessage);

  // ── Build system prompt ──
  const systemPrompt = [
    '## Persona Vector Test Mode',
    '',
    '### Hierarchy Rule',
    'Base Persona → always applied as foundation (100%)',
    'Main Vector → PRIMARY DIRECTIVE (70% influence) — this shapes the core response',
    'Supporter Vectors → SECONDARY coloring (30% combined) — adds nuance, never overrides Main',
    'Dynamic Triggers → CONTEXTUAL OVERRIDES when activated by user message',
    'When conflict occurs: Base < Supporter < Main < Active Triggers (Triggers override when activated)',
    '',
    '### Operator Type System',
    'Each essence vector has an operator type that defines HOW it modifies the response state:',
    '- TRANSFORM (Ψ→Ψ′): Convert to new state — shift framing, perspective, emotional register',
    '- GATE (Ψ→{0,1}): Conditional activation — evaluate threshold before engaging',
    '- AMPLIFY (Ψ→kΨ): Intensify existing state — more of the same, stronger',
    '- RESTRUCTURE (Ψ→TΨ): Deconstruct and rebuild — new configuration from same components',
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
    triggerInjection,
    '',
    '### Instructions',
    'Synthesize all active vectors into a unified response following the hierarchy.',
    'The Main vector is your PRIMARY voice — it defines tone, perspective, and approach.',
    'Supporter vectors add subtle coloring — they should be felt but not dominate.',
    'Z-axis essence properties should shape the emotional texture and tone of your language.',
    'When an operator type is specified, follow its behavioral directive strictly.',
    'When a dynamic trigger is activated, apply its directive with priority.',
    'Respond in Korean unless the user writes in English.',
    'Keep response concise (2-4 sentences).',
  ].join('\n');

  // ── Collect expected keywords for conflict measurement ──
  const expectedKeywords = allActive.flatMap(b => b.keywords || []);

  // ── Compute intended vector (influence-weighted average) ──
  const intendedVector = allActive.length > 0
    ? {
        x: allActive.reduce((s, b) => s + (b.vector?.x || 0) * (b.influence || 0.25), 0) /
           allActive.reduce((s, b) => s + (b.influence || 0.25), 0),
        y: allActive.reduce((s, b) => s + (b.vector?.y || 0) * (b.influence || 0.25), 0) /
           allActive.reduce((s, b) => s + (b.influence || 0.25), 0),
        z: allActive.reduce((s, b) => s + (b.vector?.z || 0) * (b.influence || 0.25), 0) /
           allActive.reduce((s, b) => s + (b.influence || 0.25), 0),
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
    const axisBreakdown = analyzeAxisContribution(responseText, allActive);

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
      activatedTriggers,
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
    const influence = b.influence || 0.25;
    const xWords = extractSignificantWords(b.interpretX || '');
    const yWords = extractSignificantWords(b.interpretY || '');
    const zWords = extractSignificantWords(b.interpretZ || '');

    const xHits = xWords.filter(w => resp.includes(w.toLowerCase())).length;
    const yHits = yWords.filter(w => resp.includes(w.toLowerCase())).length;
    const zHits = zWords.filter(w => resp.includes(w.toLowerCase())).length;

    const blockTotal = xHits + yHits + zHits;
    if (blockTotal > 0) {
      // Weight by influence — Main block contributes more to axis breakdown
      xScore += (xHits / blockTotal) * v.x * influence;
      yScore += (yHits / blockTotal) * v.y * influence;
      zScore += (zHits / blockTotal) * v.z * influence;
      total += influence;
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
