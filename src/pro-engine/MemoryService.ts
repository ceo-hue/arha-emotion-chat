import { loadValueProfile, updateValueProfile } from '../../services/firestoreService';

type ValueProfile = Record<string, number>;

export class MemoryService {
  private userId?: string;
  private storageKey: string;

  constructor(userId?: string) {
    this.userId = userId;
    this.storageKey = `hisol-pro:value-profile:${userId || 'guest'}`;
  }

  async recall(_input: string): Promise<{ primaryValues: string[]; narrative: string }> {
    const profile = await this.loadProfile();
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

  async getProfile(): Promise<ValueProfile> {
    return this.loadProfile();
  }

  async store(terms: string[]): Promise<void> {
    const normalized = terms
      .map((t) => t.trim())
      .filter((t) => t.length >= 2);

    if (normalized.length === 0) return;

    if (this.userId) {
      await updateValueProfile(this.userId, normalized);
      return;
    }

    const profile = await this.loadProfile();
    for (const term of normalized) {
      profile[term] = (profile[term] ?? 0) + 1;
    }
    localStorage.setItem(this.storageKey, JSON.stringify(profile));
  }

  async clearProfile(): Promise<void> {
    if (this.userId) return;
    localStorage.removeItem(this.storageKey);
  }

  private async loadProfile(): Promise<ValueProfile> {
    if (this.userId) {
      return (await loadValueProfile(this.userId)) ?? {};
    }

    try {
      const raw = localStorage.getItem(this.storageKey);
      if (!raw) return {};
      const parsed = JSON.parse(raw) as ValueProfile;
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch {
      return {};
    }
  }
}
