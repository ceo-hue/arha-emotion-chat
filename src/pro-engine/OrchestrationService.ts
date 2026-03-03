import { MemoryService } from './MemoryService';
import { chatWithClaudeStream } from '../services/claudeService';
import { AgentResponse } from './types';

export class OrchestrationService {
  private memory: MemoryService;
  private logger: string[] = [];

  constructor(memory: MemoryService) {
    this.memory = memory;
  }

  async process(input: string, onUpdate: (chunk: string) => void): Promise<AgentResponse> {
    this.logger = ["Initializing Value-driven Orchestration..."];
    
    const valueContext = await this.memory.recall(input);
    this.logger.push(Value Recalled: \);

    let currentContent = '';
    await chatWithClaudeStream(
      [{ role: 'user', content: \[VALUE_CONTEXT: \] \\ }],
      (chunk) => {
        currentContent += chunk;
        onUpdate(chunk);
      },
      () => {},
      \당신은 HiSol PRO 에이전트입니다. \를 최우선 가치로 삼으세요.\
    );

    const qualityGrade = currentContent.length > 100 ? 'A' : 'B';
    
    if (qualityGrade === 'B') {
      this.logger.push("Quality B detected. Refinement cycle active.");
    }

    const foundValues = ['보안', '성능', '확장성', 'UX'].filter(v => input.includes(v) || currentContent.includes(v));
    await this.memory.store(foundValues);

    return {
      container: 'C-005_Orchestrator',
      output: currentContent,
      qualityGrade,
      thoughtTrace: this.logger
    };
  }
}
