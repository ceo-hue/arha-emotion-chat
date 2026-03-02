// Adapted from: hisol-unified-mcp/src/systems/auto-trigger.ts @ v1.0
// 14-rule auto trigger engine — pure algorithm, no external API calls

import type { EmotionVector, TriggerResult, TriggerScore } from './types';
import { getAllTechPersonas, getAllPersonaNames } from './techPersonas';

// ── 14 trigger rules ─────────────────────────────────────────────────────────
type TriggerRule = (text: string, vector: EmotionVector) => number;

const TRIGGER_RULES: Array<{ name: string; rule: TriggerRule }> = [
  // Rule 1: Error/Bug detection
  { name: 'error_detection', rule: (t) => {
    const kw = ['error', 'bug', 'exception', '버그', '에러', '오류', 'undefined', 'null', 'crash', 'TypeError'];
    return kw.filter(k => t.toLowerCase().includes(k)).length * 0.15;
  }},
  // Rule 2: Performance concern
  { name: 'performance_concern', rule: (t) => {
    const kw = ['slow', 'fast', 'performance', '느림', '성능', '최적화', 'latency', 'cache'];
    return kw.filter(k => t.toLowerCase().includes(k)).length * 0.15;
  }},
  // Rule 3: Architecture question
  { name: 'architecture_question', rule: (t) => {
    const kw = ['structure', 'architecture', 'design', '구조', '설계', 'pattern', 'module'];
    return kw.filter(k => t.toLowerCase().includes(k)).length * 0.15;
  }},
  // Rule 4: Security concern
  { name: 'security_concern', rule: (t) => {
    const kw = ['security', 'auth', 'vulnerability', '보안', '취약', 'xss', 'injection', 'token'];
    return kw.filter(k => t.toLowerCase().includes(k)).length * 0.2;
  }},
  // Rule 5: Frontend context
  { name: 'frontend_context', rule: (t) => {
    const kw = ['react', 'vue', 'component', 'css', 'tailwind', 'tsx', 'jsx', 'hook', 'render'];
    return kw.filter(k => t.toLowerCase().includes(k)).length * 0.12;
  }},
  // Rule 6: TypeScript concern
  { name: 'typescript_concern', rule: (t) => {
    const kw = ['typescript', 'type error', 'interface', 'generic', 'any', 'ts', 'typing'];
    return kw.filter(k => t.toLowerCase().includes(k)).length * 0.15;
  }},
  // Rule 7: Test-related
  { name: 'test_related', rule: (t) => {
    const kw = ['test', 'jest', 'vitest', 'mock', '테스트', 'coverage', 'tdd'];
    return kw.filter(k => t.toLowerCase().includes(k)).length * 0.15;
  }},
  // Rule 8: Database/query
  { name: 'database_query', rule: (t) => {
    const kw = ['database', 'sql', 'query', 'mongodb', 'postgres', 'index', 'orm', 'db'];
    return kw.filter(k => t.toLowerCase().includes(k)).length * 0.15;
  }},
  // Rule 9: High frustration → debug focus
  { name: 'high_frustration', rule: (_, v) => {
    return v.valence < -0.4 && v.arousal > 0.5 ? 0.4 : 0;
  }},
  // Rule 10: Long technical message
  { name: 'long_technical', rule: (t) => {
    const techCount = (t.match(/[A-Z][a-z]+[A-Z]|\(\)|=>|async|await/g) || []).length;
    return Math.min(0.4, techCount * 0.08);
  }},
  // Rule 11: Code block detected
  { name: 'code_block', rule: (t) => {
    return (t.includes('```') || t.includes('`') || /function|const |let |import /.test(t)) ? 0.3 : 0;
  }},
  // Rule 12: Async/concurrency
  { name: 'async_pattern', rule: (t) => {
    const kw = ['async', 'await', 'promise', 'callback', 'race condition', '비동기', 'rxjs'];
    return kw.filter(k => t.toLowerCase().includes(k)).length * 0.18;
  }},
  // Rule 13: State management
  { name: 'state_management', rule: (t) => {
    const kw = ['useState', 'useEffect', 'redux', 'zustand', 'store', 'state', '상태', 'context'];
    return kw.filter(k => t.toLowerCase().includes(k)).length * 0.12;
  }},
  // Rule 14: Deployment/devops
  { name: 'devops_context', rule: (t) => {
    const kw = ['deploy', 'docker', 'kubernetes', 'ci/cd', 'pipeline', 'terraform', 'aws', '배포'];
    return kw.filter(k => t.toLowerCase().includes(k)).length * 0.15;
  }},
];

export class AutoTriggerEngine {
  selectPersonas(
    userInput: string,
    emotionVector: EmotionVector,
    maxCount = 3,
  ): TriggerResult {
    const personaNames = getAllPersonaNames();
    const personaDefs = getAllTechPersonas();

    const scores: TriggerScore[] = personaNames.map((name, idx) => {
      const def = personaDefs[idx];
      let score = 0;
      const reasons: string[] = [];

      // Keyword matching against persona trigger keywords
      const text = userInput.toLowerCase();
      const kwHits = def.triggerKeywords.filter(kw => text.includes(kw.toLowerCase()));
      if (kwHits.length > 0) {
        score += kwHits.length * 0.2 * def.triggerWeight;
        reasons.push(`keywords: ${kwHits.slice(0, 3).join(', ')}`);
      }

      // Apply trigger rules
      for (const { rule } of TRIGGER_RULES) {
        const ruleScore = rule(userInput, emotionVector);
        score += ruleScore * def.triggerWeight;
      }

      // Frustration boost for debugging personas
      if (emotionVector.valence < -0.3 && name === 'SeniorDebugTracer') {
        score += 0.3;
        reasons.push('high frustration → debug mode');
      }

      // Emotion modulation: high arousal boosts action-oriented personas
      if (emotionVector.arousal > 0.7) score *= 1.1;

      return { persona: name, score: Math.min(1, score), reasons };
    });

    // Sort by score, take top N with score > threshold
    const sorted = scores.sort((a, b) => b.score - a.score);
    const selected = sorted.filter(s => s.score > 0.1).slice(0, maxCount);

    const reasoning = selected.length > 0
      ? `Activated ${selected.length} expert(s): ${selected.map(s => `${s.persona}(${s.score.toFixed(2)})`).join(', ')}`
      : 'No strong technical signal detected — standard mode';

    return {
      selected_personas: selected.map(s => s.persona),
      scores: sorted.slice(0, 6), // top 6 for logging
      reasoning,
      trigger_mode: 'auto',
    };
  }
}
