/**
 * ARHA Engine Core
 * Operator / Vector / Trigger 로직 — Claude API 호출 포함
 */

// ── Operator directives ───────────────────────────────────────────────────────
const OPERATOR_DIRECTIVES = {
  transform:   'TRANSFORM: Convert the input state into a distinctly new output state. Do not merely describe — actively shift the perspective, framing, or emotional register of the response.',
  gate:        'GATE: Evaluate conditions before responding. Check if the emotional or logical requirements are met. Only engage this dimension fully if the threshold is reached. Otherwise, hold back.',
  amplify:     'AMPLIFY: Do not change direction or introduce new content. Intensify what is already present — deepen warmth, heighten clarity, increase emotional resonance. More of the same, stronger.',
  restructure: 'RESTRUCTURE: Deconstruct the premise of the input. Break down its implicit assumptions. Then reassemble into a new configuration — a fresh angle that reframes rather than answers.',
};

function buildBlockInstruction(b) {
  const v = b.vector || { x: 0.5, y: 0.5, z: 0.5 };
  const props = b.essenceProperties || {};
  const influence = b.influence || 0;
  const opType = b.operatorType || 'transform';
  const parts = [];
  parts.push(`[OPERATOR: ${opType.toUpperCase()}] ${OPERATOR_DIRECTIVES[opType]}`);
  if (v.x >= 0.3) parts.push(`[X-Objectivity: ${v.x >= 0.7 ? 'strongly' : 'moderately'} apply] ${b.interpretX || ''}`);
  if (v.y >= 0.3) parts.push(`[Y-Subjectivity: ${v.y >= 0.7 ? 'strongly' : 'moderately'} apply] ${b.interpretY || ''}`);
  if (v.z >= 0.3) {
    const propDesc = [];
    if (props.temperature !== undefined) propDesc.push(`temperature:${props.temperature > 0 ? 'warm' : 'cold'}(${Number(props.temperature).toFixed(1)})`);
    if (props.distance !== undefined)    propDesc.push(`distance:${props.distance > 0 ? 'far' : 'close'}(${Number(props.distance).toFixed(1)})`);
    if (props.density !== undefined)     propDesc.push(`density:${props.density > 0 ? 'heavy' : 'light'}(${Number(props.density).toFixed(1)})`);
    if (props.speed !== undefined)       propDesc.push(`speed:${props.speed > 0 ? 'fast' : 'slow'}(${Number(props.speed).toFixed(1)})`);
    if (props.brightness !== undefined)  propDesc.push(`brightness:${props.brightness > 0 ? 'bright' : 'dark'}(${Number(props.brightness).toFixed(1)})`);
    parts.push(`[Z-Essence: ${v.z >= 0.7 ? 'strongly' : 'moderately'} apply | ${propDesc.join(', ')}] ${b.interpretZ || ''}`);
  }
  return `## ${b.funcNotation || b.nameEn || 'Block'} [${opType}|X:${v.x.toFixed(2)},Y:${v.y.toFixed(2)},Z:${v.z.toFixed(2)}] (influence: ${(influence * 100).toFixed(0)}%)\n${parts.join('\n')}`;
}

function buildTriggerInjection(triggers, message) {
  if (!triggers?.length) return { injection: '', activatedTriggers: [] };
  const msgLower = message.toLowerCase();
  const activated = [], directives = [];
  for (const trigger of triggers) {
    if (trigger.conditionKeywords?.some(kw => msgLower.includes(kw.toLowerCase()))) {
      activated.push(`${trigger.emoji ?? ''} ${trigger.labelEn}`);
      directives.push(
        `### 🔔 DYNAMIC TRIGGER ACTIVATED: ${trigger.emoji ?? ''} ${trigger.labelEn} [${trigger.preferredOperator.toUpperCase()}]`,
        `Condition: ${trigger.conditionDesc}`,
        `Directive: ${trigger.responseDirective}`,
      );
    }
  }
  if (!directives.length) return { injection: '', activatedTriggers: [] };
  return { injection: ['', '## ⚡ PERSONA DYNAMIC TRIGGERS (Active)', ...directives].join('\n'), activatedTriggers: activated };
}

function extractWords(text) {
  return text.replace(/[^\uAC00-\uD7A3a-zA-Z\s]/g, '').split(/\s+/).filter(w => w.length > 1);
}

function analyzeAxisContribution(responseText, blocks) {
  const resp = responseText.toLowerCase();
  let xScore = 0, yScore = 0, zScore = 0, total = 0;
  for (const b of blocks) {
    const v = b.vector || { x: 0.5, y: 0.5, z: 0.5 };
    const influence = b.influence || 0.25;
    const xWords = extractWords(b.interpretX || '');
    const yWords = extractWords(b.interpretY || '');
    const zWords = extractWords(b.interpretZ || '');
    const xHits = xWords.filter(w => resp.includes(w.toLowerCase())).length;
    const yHits = yWords.filter(w => resp.includes(w.toLowerCase())).length;
    const zHits = zWords.filter(w => resp.includes(w.toLowerCase())).length;
    const blockTotal = xHits + yHits + zHits;
    if (blockTotal > 0) {
      xScore += (xHits / blockTotal) * v.x * influence;
      yScore += (yHits / blockTotal) * v.y * influence;
      zScore += (zHits / blockTotal) * v.z * influence;
      total += influence;
    }
  }
  if (total === 0) return { x: 0.33, y: 0.33, z: 0.33 };
  const sum = xScore + yScore + zScore;
  return sum > 0 ? { x: xScore / sum, y: yScore / sum, z: zScore / sum } : { x: 0.33, y: 0.33, z: 0.33 };
}

function cosineSimilarity(a, b) {
  const dot = a.reduce((s, v, i) => s + v * b[i], 0);
  const magA = Math.sqrt(a.reduce((s, v) => s + v * v, 0));
  const magB = Math.sqrt(b.reduce((s, v) => s + v * v, 0));
  return magA > 0 && magB > 0 ? dot / (magA * magB) : 0;
}

// ── 시스템 프롬프트 빌더 ────────────────────────────────────────────────────────
function buildSystemPrompt(persona, blocks) {
  const allActive = blocks.filter(b => (b.vector?.x || 0) + (b.vector?.y || 0) + (b.vector?.z || 0) > 0);
  const mainBlock = allActive.find(b => b.role === 'main');
  const supporterBlocks = allActive.filter(b => b.role === 'supporter');

  const essenceSections = [];
  if (mainBlock) essenceSections.push('# ★ PRIMARY DIRECTIVE (Main Vector — 70%)', buildBlockInstruction(mainBlock));
  if (supporterBlocks.length > 0) {
    essenceSections.push('', '# ◇ SUPPORT LAYER (Auxiliary — combined 30%)');
    supporterBlocks.forEach((b, i) => essenceSections.push(`### Supporter #${i + 1}`, buildBlockInstruction(b)));
  }

  return {
    systemPrompt: [
      '## ARHA Persona Engine', '',
      '### Priority: Base Persona → Main Vector (70%) → Supporters (30%) → Active Triggers', '',
      '### Operator Types',
      '- TRANSFORM (Ψ→Ψ′): Shift state',
      '- GATE (Ψ→{0,1}): Conditional activation',
      '- AMPLIFY (Ψ→kΨ): Intensify existing',
      '- RESTRUCTURE (Ψ→TΨ): Deconstruct and rebuild', '',
      '### Base Persona',
      persona.summary, '',
      essenceSections.length > 0 ? '### Active Essence Vectors' : '',
      essenceSections.join('\n'), '',
      '### Instructions',
      'Synthesize all vectors. Main vector defines core tone. Supporters add nuance.',
      'Respond in Korean unless the user writes in English.',
    ].filter(l => l !== null).join('\n'),
    allActive,
  };
}

// ── 메인 chat 함수 ─────────────────────────────────────────────────────────────
/**
 * @param {object} opts
 * @param {string} opts.anthropicKey   - 사용자의 Anthropic API 키
 * @param {object} opts.persona        - { summary, triggers[] }
 * @param {Array}  opts.blocks         - ARHA 에센스 블록 배열
 * @param {string} opts.message        - 유저 메시지
 * @param {Array}  [opts.history]      - 이전 대화 [{ role, content }]
 * @param {string} [opts.model]        - Claude 모델 (기본: claude-sonnet-4-20250514)
 * @param {number} [opts.maxTokens]    - 최대 토큰 (기본: 1024)
 * @returns {Promise<ArhaResult>}
 */
export async function chat({ anthropicKey, persona, blocks = [], message, history = [], model, maxTokens }) {
  if (!anthropicKey) throw new Error('anthropicKey is required');
  if (!message)      throw new Error('message is required');
  if (!persona?.summary) throw new Error('persona.summary is required');

  const { systemPrompt, allActive } = buildSystemPrompt(persona, blocks);
  const { injection: triggerInjection, activatedTriggers } = buildTriggerInjection(persona.triggers, message);
  const fullSystemPrompt = systemPrompt + triggerInjection;

  const messages = [
    ...(history ?? []).map(h => ({ role: h.role, content: h.content })),
    { role: 'user', content: message },
  ];

  const resp = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': anthropicKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: model || 'claude-sonnet-4-20250514',
      max_tokens: maxTokens || 1024,
      system: fullSystemPrompt,
      messages,
    }),
  });

  if (!resp.ok) {
    const errText = await resp.text();
    throw new Error('Claude API error: ' + errText);
  }

  const data = await resp.json();
  const responseText = data.content?.find(b => b.type === 'text')?.text ?? '';

  // 분석
  const expectedKeywords = allActive.flatMap(b => b.keywords || []);
  const uniqueExpected = [...new Set(expectedKeywords.map(k => k.toLowerCase()))];
  const matchedKeywords = uniqueExpected.filter(kw => responseText.toLowerCase().includes(kw));
  const conflictIndex = uniqueExpected.length > 0
    ? Math.max(0, 1.0 - matchedKeywords.length / uniqueExpected.length)
    : 0;

  const intendedVector = allActive.length > 0 ? {
    x: allActive.reduce((s, b) => s + (b.vector?.x || 0) * (b.influence || 0.25), 0) / allActive.reduce((s, b) => s + (b.influence || 0.25), 0),
    y: allActive.reduce((s, b) => s + (b.vector?.y || 0) * (b.influence || 0.25), 0) / allActive.reduce((s, b) => s + (b.influence || 0.25), 0),
    z: allActive.reduce((s, b) => s + (b.vector?.z || 0) * (b.influence || 0.25), 0) / allActive.reduce((s, b) => s + (b.influence || 0.25), 0),
  } : { x: 0.5, y: 0.5, z: 0.5 };

  const axisBreakdown = analyzeAxisContribution(responseText, allActive);
  const vectorDistance = cosineSimilarity(
    [intendedVector.x, intendedVector.y, intendedVector.z],
    [axisBreakdown.x, axisBreakdown.y, axisBreakdown.z],
  );

  return {
    response: responseText,
    conflictIndex:   Math.round(conflictIndex * 100) / 100,
    vectorDistance:  Math.round(vectorDistance * 100) / 100,
    axisBreakdown: {
      x: Math.round(axisBreakdown.x * 100) / 100,
      y: Math.round(axisBreakdown.y * 100) / 100,
      z: Math.round(axisBreakdown.z * 100) / 100,
    },
    activatedTriggers,
  };
}
