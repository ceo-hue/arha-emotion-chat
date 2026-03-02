// Adapted from: hisol-unified-mcp/src/systems/prompt-builder.ts @ v1.0
// Expert panel prompt builder — pure string assembly

import type { ProTechExpert, ProEmotionResult } from '../../types';

export function buildExpertPanelPrompt(
  experts: ProTechExpert[],
  emotionResult: ProEmotionResult,
  contextSummary: string,
): string {
  if (experts.length === 0) return '';

  const expertSections = experts.map((e, i) => {
    const badge = i === 0 ? '🔬' : i === 1 ? '🛡️' : '⚡';
    return [
      `### ${badge} ${e.name} (score: ${(e.score * 100).toFixed(0)}%)`,
      `**Mission:** ${e.mission}`,
      `**Key Actions:** ${e.actions.slice(0, 3).join(' → ')}`,
      `**Guardrails:** ${e.guardrails.slice(0, 2).join(' | ')}`,
    ].join('\n');
  }).join('\n\n');

  const ev = emotionResult.vector;
  const emotionLine = [
    `Emotional state: **${emotionResult.primaryEmotion}**`,
    `valence=${ev.valence.toFixed(2)}`,
    `arousal=${ev.arousal.toFixed(2)}`,
    `intensity=${ev.intensity.toFixed(2)}`,
    `confidence=${(emotionResult.confidence * 100).toFixed(0)}%`,
  ].join(' | ');

  const ctxLine = contextSummary && contextSummary !== 'general'
    ? `Tech stack detected: **${contextSummary}**\n\n`
    : '';

  return [
    '',
    '---',
    '## 🔬 PRO Mode — Expert Panel Active',
    '',
    ctxLine + expertSections,
    '',
    emotionLine,
    '',
    '> Apply the expertise above to enhance your response quality, precision, and depth.',
    '---',
  ].join('\n');
}
