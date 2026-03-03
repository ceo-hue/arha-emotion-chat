import { chatWithClaudeStream } from '../../services/claudeService';
import { Message, ProTechExpert } from '../../types';
import { MemoryService } from './MemoryService';
import { AgentResponse } from './types';
import { EmotionEngine } from '../pro/emotionEngine';
import { AutoTriggerEngine } from '../pro/autoTrigger';
import { ContextManager } from '../pro/contextManager';
import { getTechPersona } from '../pro/techPersonas';
import { buildExpertPanelPrompt } from '../pro/promptBuilder';

const PRO_SYSTEM_PROMPT = `당신은 HiSol PRO 에이전트입니다.
- 입력 문제를 구조적으로 분해하세요.
- 가치 문맥(Value Context)을 우선 고려해 답변하세요.
- 결론은 실행 가능한 단계로 제시하세요.`;

export class OrchestrationService {
  private memory: MemoryService;
  private contextManager: ContextManager;
  private logger: string[] = [];

  constructor(memory: MemoryService) {
    this.memory = memory;
    this.contextManager = new ContextManager();
  }

  async process(input: string, onUpdate: (chunk: string) => void, history: string[] = []): Promise<AgentResponse> {
    this.logger = ['C-000 Bootstrap: Initialize PRO workspace orchestration'];

    // C-001 Emotion engine
    const emotionEngine = new EmotionEngine();
    const emotionResult = emotionEngine.processEmotion({
      input,
      mode: history.length > 3 ? 'advanced' : 'basic',
      sessionHistory: history.slice(-5),
    });
    this.logger.push(
      `C-001 EmotionEngine: ${emotionResult.primaryEmotion} | v=${emotionResult.emotionVector.valence.toFixed(2)} a=${emotionResult.emotionVector.arousal.toFixed(2)} i=${emotionResult.emotionVector.intensity.toFixed(2)}`,
    );

    // C-002 Auto trigger
    const trigger = new AutoTriggerEngine();
    const triggerResult = trigger.selectPersonas(input, emotionResult.emotionVector, 3);
    this.logger.push(
      `C-002 AutoTrigger: ${triggerResult.selected_personas.length > 0 ? triggerResult.selected_personas.join(', ') : 'none'}`,
    );

    // C-003 Context manager
    this.contextManager.extractHints(input);
    const ctx = this.contextManager.getContext();
    const fwList = ctx.project_context.frameworks.slice(0, 3).join(', ');
    const langList = ctx.project_context.languages.slice(0, 2).join(', ');
    const contextSummary = [fwList, langList].filter(Boolean).join(' / ') || 'general';
    this.logger.push(`C-003 ContextManager: ${contextSummary}`);

    const experts: ProTechExpert[] = triggerResult.selected_personas
      .map((name) => {
        try {
          const def = getTechPersona(name);
          const scoreEntry = triggerResult.scores.find((s) => s.persona === name);
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
      })
      .filter((e): e is ProTechExpert => e !== null);

    // C-004 Prompt composer
    const expertPrompt = buildExpertPanelPrompt(
      experts,
      {
        primaryEmotion: emotionResult.primaryEmotion,
        vector: emotionResult.emotionVector,
        confidence: emotionResult.confidence,
        emotionTags: emotionResult.emotionTags,
        processingMode: emotionResult.processingMode,
      },
      contextSummary,
    );
    this.logger.push(
      `C-004 PromptComposer: expert panel ${experts.length > 0 ? 'attached' : 'skipped'} (${experts.length} expert${experts.length === 1 ? '' : 's'})`,
    );

    // C-005 Orchestrator with value memory
    const valueContext = await this.memory.recall(input);
    this.logger.push(`C-005 ValueMemory: ${valueContext.primaryValues.join(', ') || 'none'}`);

    let currentContent = '';
    const message: Message = {
      id: `${Date.now()}-pro-user`,
      role: 'user',
      content: `[VALUE_CONTEXT]\n${valueContext.narrative}\n\n[CONTEXT_SUMMARY]\n${contextSummary}\n\n[USER_INPUT]\n${input}`,
      timestamp: Date.now(),
    };

    await chatWithClaudeStream(
      [message],
      (chunk) => {
        currentContent += chunk;
        onUpdate(chunk);
      },
      () => {
        // PRO workspace does not consume structured analysis yet.
      },
      `${PRO_SYSTEM_PROMPT}${expertPrompt}`,
    );

    const qualityGrade: AgentResponse['qualityGrade'] = currentContent.length > 180 ? 'A' : currentContent.length > 90 ? 'B+' : 'B';
    this.logger.push(`C-005 QualityGate: ${qualityGrade}`);

    const foundValues = ['보안', '성능', '확장성', 'UX'].filter(
      (v) => input.includes(v) || currentContent.includes(v),
    );
    await this.memory.store(foundValues);

    return {
      container: 'C-005_Orchestrator',
      output: currentContent,
      qualityGrade,
      thoughtTrace: this.logger,
    };
  }
}
