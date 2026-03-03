import { chatWithClaudeStream } from '../../services/claudeService';
import { Message } from '../../types';
import { MemoryService } from './MemoryService';
import { AgentResponse } from './types';

const PRO_SYSTEM_PROMPT = `당신은 HiSol PRO 에이전트입니다.
- 입력 문제를 구조적으로 분해하세요.
- 가치 문맥(Value Context)을 우선 고려해 답변하세요.
- 결론은 실행 가능한 단계로 제시하세요.`;

export class OrchestrationService {
  private memory: MemoryService;
  private logger: string[] = [];

  constructor(memory: MemoryService) {
    this.memory = memory;
  }

  async process(input: string, onUpdate: (chunk: string) => void): Promise<AgentResponse> {
    this.logger = ['Initializing Value-driven Orchestration...'];

    const valueContext = await this.memory.recall(input);
    this.logger.push(`Value recalled: ${valueContext.primaryValues.join(', ') || 'none'}`);

    let currentContent = '';
    const message: Message = {
      id: `${Date.now()}-pro-user`,
      role: 'user',
      content: `[VALUE_CONTEXT]\n${valueContext.narrative}\n\n[USER_INPUT]\n${input}`,
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
      PRO_SYSTEM_PROMPT,
    );

    const qualityGrade: AgentResponse['qualityGrade'] = currentContent.length > 180 ? 'A' : currentContent.length > 90 ? 'B+' : 'B';
    this.logger.push(`Quality grade: ${qualityGrade}`);

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

