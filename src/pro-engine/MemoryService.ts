import { loadValueProfile, updateValueProfile } from '../../services/firestoreService';

export class MemoryService {
  private userId?: string;

  constructor(userId?: string) {
    this.userId = userId;
  }

  async recall(_input: string): Promise<{ primaryValues: string[]; narrative: string }> {
    if (!this.userId) {
      return {
        primaryValues: [],
        narrative: '새로운 가치 지도를 그려 나가는 중입니다.',
      };
    }

    const profile = (await loadValueProfile(this.userId)) ?? {};
    const ranked = Object.entries(profile)
      .sort((a, b) => b[1] - a[1])
      .map(([term]) => term);

    const top = ranked.slice(0, 3);

    return {
      primaryValues: top,
      narrative:
        top.length > 0
          ? `사용자님께서는 그동안 ${top.join(', ')} 등의 가치를 가장 중요하게 여기셨습니다.`
          : '새로운 가치 지도를 그려 나가는 중입니다.',
    };
  }

  async store(terms: string[]): Promise<void> {
    if (!this.userId || terms.length === 0) return;
    await updateValueProfile(this.userId, terms);
  }
}

