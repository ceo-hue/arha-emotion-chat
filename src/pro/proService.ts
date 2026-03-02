// src/pro/proService.ts
// PRO mode main entry point — coordinates all sub-engines
// No external API calls, runs entirely in browser

import { EmotionEngine } from './emotionEngine';
import { AutoTriggerEngine } from './autoTrigger';
import { ContextManager } from './contextManager';
import { getTechPersona } from './techPersonas';
import { logger } from './logger';
import type { ProModeData, ProEmotionResult, ProTechExpert } from '../../types';

// Reuse context manager across calls to accumulate session context
const sessionCtxManager = new ContextManager();

export async function analyzeForPro(
  userInput: string,
  history: string[],
): Promise<ProModeData> {
  try {
    // Step 1: Emotion analysis (7-layer)
    const engine = new EmotionEngine();
    const result = engine.processEmotion({
      input: userInput,
      mode: history.length > 3 ? 'advanced' : 'basic',
      sessionHistory: history.slice(-5),
    });

    const emotionResult: ProEmotionResult = {
      primaryEmotion: result.primaryEmotion,
      vector: result.emotionVector,
      confidence: result.confidence,
      emotionTags: result.emotionTags,
      processingMode: result.processingMode,
    };

    // Step 2: Auto-trigger persona selection
    const trigger = new AutoTriggerEngine();
    const triggerResult = trigger.selectPersonas(userInput, result.emotionVector, 3);

    // Step 3: Map to ProTechExpert objects
    const techExperts: ProTechExpert[] = triggerResult.selected_personas.map(name => {
      try {
        const def = getTechPersona(name);
        const scoreEntry = triggerResult.scores.find(s => s.persona === name);
        return {
          name,
          mission: def.mission,
          actions: def.actions,
          guardrails: def.guardrails,
          kpis: def.kpis,
          score: scoreEntry?.score ?? 0,
        };
      } catch {
        return null;
      }
    }).filter((e): e is ProTechExpert => e !== null);

    // Step 4: Context extraction (accumulates across session)
    sessionCtxManager.extractHints(userInput);
    const ctx = sessionCtxManager.getContext();
    const fwList = ctx.project_context.frameworks.slice(0, 3).join(', ');
    const langList = ctx.project_context.languages.slice(0, 2).join(', ');
    const contextSummary = [fwList, langList].filter(Boolean).join(' / ') || 'general';

    logger.debug('PRO analysis:', { emotion: result.primaryEmotion, experts: techExperts.map(e => e.name), contextSummary });

    return {
      emotionResult,
      techExperts,
      contextSummary,
      reasoning: triggerResult.reasoning,
    };
  } catch (err) {
    logger.error('PRO analysis failed, returning empty result:', err);
    // Fail gracefully — return minimal data (no crash, no API impact)
    return {
      emotionResult: {
        primaryEmotion: 'neutral',
        vector: { valence: 0, arousal: 0.3, intensity: 0.3 },
        confidence: 0,
        emotionTags: [],
        processingMode: 'basic',
      },
      techExperts: [],
      contextSummary: 'general',
      reasoning: 'Analysis unavailable',
    };
  }
}

/** Reset session context (call on new conversation start) */
export function resetProSession(): void {
  sessionCtxManager.reset();
}
