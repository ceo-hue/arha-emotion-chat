import { loadValueProfile, updateValueProfile } from '../services/firestoreService';
import { ValueChain, ValueNode } from './types';

export class MemoryService {
  private userId: string;

  constructor(userId: string) {
    this.userId = userId;
  }

  async recall(input: string): Promise<{ primaryValues: string[]; narrative: string }> {
    const profile = await loadValueProfile(this.userId) as any;
    const terms = Object.keys(profile || {}).sort((a, b) => profile[b] - profile[a]);
    const top = terms.slice(0, 3);
    
    return {
      primaryValues: top,
      narrative: top.length > 0 
        ? 사용자님께서는 그동안 \ 등의 가치를 가장 중요하게 여기셨습니다. 
        : "새로운 가치 지도를 그려 나가는 중입니다."
    };
  }

  async store(terms: string[]): Promise<void> {
    if (this.userId && terms.length > 0) {
      await updateValueProfile(this.userId, terms);
    }
  }
}
